import { fork, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import pg from 'pg';

const adminUrl = new URL(process.env.PROJECTOS_TEST_POSTGRES_URL ?? 'file:/');
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || !['127.0.0.1','localhost'].includes(adminUrl.hostname)
  || adminUrl.pathname !== '/postgres') throw new Error('A loopback PostgreSQL test admin database is required');

const database = 'projectos_test_' + randomBytes(6).toString('hex');
const runtime = new URL('/' + database, adminUrl);
const scratch = await mkdtemp(join(tmpdir(),'projectos-pg-http-'));
const admin = new pg.Client({connectionString:adminUrl.href});
const setupToken = 'synthetic-runtime-test-bootstrap-token';
let server, existed = false;

async function startServer(env) {
  server = fork(resolve('scripts/prepare-e2e.mjs'),[],{env,stdio:['ignore','ignore','pipe','ipc']});
  server.stderr?.resume();
  return new Promise((ok,fail)=>{
    const timeout = setTimeout(()=>fail(new Error('PostgreSQL production build test server not ready')),30_000);
    server.once('exit',()=>{clearTimeout(timeout);fail(new Error('PostgreSQL production build test server exited'));});
    server.once('error',error=>{clearTimeout(timeout);fail(error);});
    server.once('message',message=>{clearTimeout(timeout);ok(message.url);});
  });
}

async function stopServer() {
  if (server && server.exitCode===null && server.signalCode===null) {
    const exited=once(server,'exit');
    server.kill();
    await exited;
  }
}

try {
  await admin.connect();
  await admin.query('CREATE DATABASE "' + database + '"');
  existed = true;
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^PROJECTOS_/i.test(name))),
    NODE_ENV:'production', PROJECTOS_DATABASE_URL:runtime.href, PROJECTOS_DB_PATH:join(scratch,'must-not-exist.sqlite'),
    PROJECTOS_SETUP_TOKEN:setupToken, PROJECTOS_AI_ENABLED:'disabled', PROJECTOS_GITHUB_TOKEN:'',
  };
  execFileSync(process.execPath,[resolve('scripts/migrate-postgres.mjs')],{env,stdio:['ignore','ignore','pipe'],timeout:30_000});
  let appUrl = await startServer(env);
  const ready = await fetch(appUrl+'/api/health');
  assert.equal(ready.status,200);
  const headers={'Content-Type':'application/json',Origin:appUrl,'Sec-Fetch-Site':'same-origin'};
  const account={email:'runtime@example.test',password:'synthetic-test-only-password',displayName:'Local runtime',workspace:'Local runtime'};
  const created=await fetch(appUrl+'/api/auth/setup',{
    headers,method:'POST',body:JSON.stringify({setupToken,...account}),signal:AbortSignal.timeout(10_000),
  });
  assert.equal(created.status,200);
  const cookie = created.headers.get('set-cookie');
  assert.match(cookie,/__Host-projectos_session=/);
  assert.match(cookie,/HttpOnly/i);
  assert.match(cookie,/Secure/i);
  headers.Cookie=cookie.split(';',1)[0];
  const project={id:'http-project',name:'HTTP project',subtitle:'',coverTitle:'HTTP project',description:'',status:'building',
    type:'Website',progress:0,next:'',art:'navigation/projects'};
  const resource={id:'http-server',name:'Synthetic server',projectId:project.id,linkedProjectIds:[],type:'server',
    address:'203.0.113.81',environment:'Development',status:'registered',provider:'Fixture host',tags:[]};
  const change=await fetch(appUrl+'/api/records',{headers,method:'PATCH',body:JSON.stringify({
    version:0,changes:[{kind:'projects',id:project.id,action:'create',record:project},
      {kind:'resources',id:resource.id,action:'create',record:resource}],
  })});
  assert.equal(change.status,200);
  const response=await fetch(appUrl+'/api/records/projects/'+project.id,{headers});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).record,project);
  assert.equal((await fetch(appUrl+'/api/state')).status,401);
  const pgClient = new pg.Client({connectionString:runtime.href});
  let workspace;
  try {
    await pgClient.connect();
    assert.equal((await pgClient.query("SELECT COUNT(*) FROM records WHERE kind='projects'")).rows[0].count,'1');
    workspace=(await pgClient.query('SELECT id FROM workspaces')).rows[0].id;
  } finally { await pgClient.end(); }
  await stopServer();
  const agentToken='synthetic-runtime-monitor-agent-fixture-only';
  appUrl=await startServer({...env, PROJECTOS_MONITOR_WORKSPACE:workspace,
    PROJECTOS_MONITOR_AGENT_TOKEN:agentToken, PROJECTOS_MONITOR_AGENT_RESOURCES:resource.id});
  headers.Origin=appUrl;
  const observe=(body, token=agentToken)=>fetch(appUrl+'/api/monitoring/observations',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify(body),signal:AbortSignal.timeout(10_000),
  });
  const reading={resourceId:resource.id,cpuPercent:25,usedBytes:512,totalBytes:1024,
    diskUsedBytes:6144,diskTotalBytes:8192,observedAt:new Date().toISOString()};
  assert.equal((await observe(reading,'invalid-fixture')).status,401);
  assert.equal((await observe({...reading,diskTotalBytes:undefined})).status,422);
  assert.equal((await observe({...reading,diskUsedBytes:9999})).status,422);
  assert.equal((await observe({...reading,resourceId:'other-resource'})).status,404);
  assert.deepEqual(await (await observe(reading)).json(),{accepted:true});
  assert.deepEqual(await (await observe(reading)).json(),{accepted:false});
  assert.deepEqual(await (await observe({...reading,observedAt:new Date(Date.parse(reading.observedAt)-1000).toISOString(),
    diskUsedBytes:undefined,diskTotalBytes:undefined})).json(),{accepted:true});
  const endpoint=appUrl+'/api/monitoring?resourceId='+resource.id;
  assert.equal((await fetch(endpoint)).status,401);
  const monitored=await fetch(endpoint,{headers});
  assert.equal(monitored.status,200);
  const {machineObservations}=await monitored.json();
  assert.equal(machineObservations.length,2);
  assert.deepEqual(machineObservations[0],{resourceId:resource.id,checkedAt:reading.observedAt,source:'machine-agent',
    state:'observed',cpuPercent:25,usedBytes:512,totalBytes:1024,diskUsedBytes:6144,diskTotalBytes:8192});
  assert.equal(machineObservations[1].diskUsedBytes,null);
  assert.equal(machineObservations[1].diskTotalBytes,null);
  assert.equal((await fetch(appUrl+'/api/monitoring?resourceId=other-resource',{headers})).status,404);
  const viewer='runtime-viewer@example.test';
  const invitation=await fetch(appUrl+'/api/team/invitations',{method:'POST',headers,
    body:JSON.stringify({email:viewer,role:'viewer',projectIds:[]})});
  assert.equal(invitation.status,200);
  const joined=await fetch(appUrl+'/api/auth/accept-invite',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:appUrl,'Sec-Fetch-Site':'same-origin'},
    body:JSON.stringify({token:(await invitation.json()).token,email:viewer,password:account.password,displayName:'Fixture viewer'})});
  assert.equal(joined.status,200);
  assert.equal((await fetch(endpoint,{headers:{Cookie:joined.headers.get('set-cookie').split(';',1)[0]}})).status,404);
  console.log(JSON.stringify({ok:true,mode:'production-build-http-postgresql',machineObservation:'scoped-with-disk'}));
} finally {
  await stopServer();
  if (existed) await admin.query('DROP DATABASE "' + database + '"');
  await admin.end();
  await rm(scratch,{recursive:true,force:true,maxRetries:4});
}
