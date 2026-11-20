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
const runtimeRole = database.replace('projectos_test_', 'projectos_app_');
const runtimePassword = randomBytes(24).toString('hex');
const scratch = await mkdtemp(join(tmpdir(),'projectos-pg-http-'));
const admin = new pg.Client({connectionString:adminUrl.href});
const setupToken = 'synthetic-runtime-test-bootstrap-token';
let server, existed = false, roleCreated = false;

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
  await admin.query(`CREATE ROLE "${runtimeRole}" LOGIN PASSWORD '${runtimePassword}'`);
  roleCreated = true;
  const psql = process.env.PROJECTOS_PG_BIN ? join(process.env.PROJECTOS_PG_BIN, 'psql') : 'psql';
  execFileSync(psql,['-X','-h',adminUrl.hostname,'-p',adminUrl.port||'5432','-U',decodeURIComponent(adminUrl.username),
    '-d',database,'-v','runtime_role='+runtimeRole,'-f',resolve('schema/postgres/grant-runtime.sql')],{
    env:{...env, PGPASSWORD:decodeURIComponent(adminUrl.password)},stdio:['ignore','ignore','pipe'],timeout:30_000,
  });
  const appDatabase = new URL(runtime);
  const signingKey=randomBytes(32);
  const installer=new pg.Client({connectionString:runtime.href});
  await installer.connect();
  try { await installer.query('INSERT INTO projectos_private.scope_key VALUES(true,$1)',[signingKey]); }
  finally { await installer.end(); }
  env.PROJECTOS_DB_SCOPE_KEY=signingKey.toString('hex');
  appDatabase.username = runtimeRole;
  appDatabase.password = runtimePassword;
  env.PROJECTOS_DATABASE_URL = appDatabase.href;
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
    type:'Website',progress:0,next:'Verify synthetic acceptance data',art:'navigation/projects'};
  const otherProject={...project,id:'other-project',name:'Other project',next:''};
  const resource={id:'http-server',name:'Synthetic server',projectId:project.id,linkedProjectIds:[],type:'server',
    address:'203.0.113.81',environment:'Development',status:'registered',provider:'Fixture host',tags:[]};
  const change=await fetch(appUrl+'/api/records',{headers,method:'PATCH',body:JSON.stringify({
    version:0,changes:[{kind:'projects',id:project.id,action:'create',record:project},
      {kind:'projects',id:otherProject.id,action:'create',record:otherProject},
      {kind:'resources',id:resource.id,action:'create',record:resource}],
  })});
  assert.equal(change.status,200);
  const response=await fetch(appUrl+'/api/records/projects/'+project.id,{headers});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).record,project);
  assert.equal((await fetch(appUrl+'/api/state')).status,401);
  const pgClient = new pg.Client({connectionString:runtime.href});
  let workspace;
  const repositories=[[project.id,'fixture/first'],[otherProject.id,'fixture/second']];
  try {
    await pgClient.connect();
    assert.equal((await pgClient.query("SELECT COUNT(*) FROM records WHERE kind='projects'")).rows[0].count,'2');
    workspace=(await pgClient.query('SELECT id FROM workspaces')).rows[0].id;
    const checkedAt=new Date().toISOString();
    for(const [projectId,repository] of repositories) {
      const sample={repository,checkedAt,state:'connected',
        commits:[{sha:'a'.repeat(40),subject:'Verified scoped sample',committedAt:checkedAt}]};
      await pgClient.query('INSERT INTO github_snapshots(workspace_id,project_id,repo,checked_at,status,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [workspace,projectId,repository,checkedAt,'connected',JSON.stringify(sample)]);
    }
  } finally { await pgClient.end(); }
  await stopServer();
  const agentToken='synthetic-runtime-monitor-agent-fixture-only';
  appUrl=await startServer({...env, PROJECTOS_MONITOR_WORKSPACE:workspace,
    PROJECTOS_MONITOR_AGENT_TOKEN:agentToken, PROJECTOS_MONITOR_AGENT_RESOURCES:resource.id,
    PROJECTOS_GITHUB_PROJECTS:JSON.stringify(repositories.map(([projectId,repository])=>({workspaceId:workspace,projectId,repository}))),
    PROJECTOS_GITHUB_TOKEN:'synthetic-binding-fixture'});
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
    body:JSON.stringify({email:viewer,role:'viewer',projectIds:[otherProject.id]})});
  assert.equal(invitation.status,200);
  const joined=await fetch(appUrl+'/api/auth/accept-invite',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:appUrl,'Sec-Fetch-Site':'same-origin'},
    body:JSON.stringify({token:(await invitation.json()).token,email:viewer,password:account.password,displayName:'Fixture viewer'})});
  assert.equal(joined.status,200);
  const viewerHeaders={Cookie:joined.headers.get('set-cookie').split(';',1)[0]};
  const version=(await (await fetch(appUrl+'/api/state',{headers})).json()).version;
  const revisions=[project,otherProject].map(({id})=>({kind:'docs',id:'doc-'+id,action:'create',
    record:{id:'doc-'+id,projectId:id,title:'Synthetic runbook',type:'Runbook',body:'Synthetic history evidence',
      revision:1,updated:'2026-11-20'}}));
  assert.equal((await fetch(appUrl+'/api/records',{headers,method:'PATCH',body:JSON.stringify({version,changes:revisions})})).status,200);
  const history=(id,session)=>fetch(appUrl+'/api/docs/history?id=doc-'+id,{headers:session});
  const [ownerHistory,visibleHistory,hiddenHistory]=await Promise.all([
    history(project.id,headers),history(otherProject.id,viewerHeaders),history(project.id,viewerHeaders),
  ]);
  assert.equal(ownerHistory.status,200);
  assert.equal((await ownerHistory.json()).versions.length,1);
  assert.equal(visibleHistory.status,200);
  assert.equal((await visibleHistory.json()).versions.length,1);
  assert.equal(hiddenHistory.status,404);
  assert.equal((await fetch(endpoint,{headers:viewerHeaders})).status,404);
  const github=appUrl+'/api/integrations/github';
  assert.equal((await fetch(github,{headers:viewerHeaders})).status,403);
  assert.equal((await fetch(github+'?projectId='+project.id,{headers:viewerHeaders})).status,404);
  const visible=await fetch(github+'?projectId='+otherProject.id,{headers:viewerHeaders});
  assert.equal(visible.status,200);
  assert.deepEqual((await visible.json()).repositories.map(({repository})=>repository),['fixture/second']);
  const denied=await fetch(github,{method:'POST',headers:{...headers,...viewerHeaders},
    body:JSON.stringify({projectId:otherProject.id,repository:'fixture/second',backfill:true})});
  assert.equal(denied.status,403);
  const published=await fetch(appUrl+'/api/activity',{method:'POST',headers,
    body:JSON.stringify({projectId:project.id,title:'Verified synthetic activity',detail:'Fixture evidence from the PostgreSQL HTTP run.'})});
  assert.equal(published.status,200);
  const resume=(scope,cookies=headers)=>fetch(appUrl+'/api/assistant',{method:'POST',headers:{...headers,...cookies},
    body:JSON.stringify({intent:'resume',projectId:scope,allowExternal:true})});
  const resumed=await resume(project.id);
  assert.equal(resumed.status,200);
  const memory=await resumed.json();
  assert.equal(memory.mode,'resume');
  assert.equal(memory.externalTransmission,false);
  assert.ok(memory.answer.includes(project.next));
  assert.ok(memory.answer.includes('Verified synthetic activity'));
  const activity=memory.citations.find(item=>item.kind==='activity').href;
  assert.equal((await fetch(appUrl+activity,{headers})).status,200);
  const readEvent=await fetch(appUrl+'/api'+activity,{headers});
  assert.equal(readEvent.status,200);
  assert.equal((await readEvent.json()).activity.title,'Verified synthetic activity');
  assert.equal((await fetch(appUrl+'/api'+activity,{headers:viewerHeaders})).status,404);
  const hiddenPage=await (await fetch(appUrl+activity,{headers:viewerHeaders})).text();
  assert.ok(hiddenPage.includes('صفحه پیدا نشد'));
  assert.ok(!hiddenPage.includes('Verified synthetic activity'));
  assert.equal((await resume(project.id,viewerHeaders)).status,404);
  assert.equal((await resume(otherProject.id,viewerHeaders)).status,200);
  const writeActivity=body=>fetch(appUrl+'/api/activity',{method:'POST',headers,body:JSON.stringify(body)});
  const checkpoint={projectId:project.id,title:'Synthetic recorded follow-up',detail:'A local PostgreSQL task fixture.'};
  assert.equal((await writeActivity({...checkpoint,createTask:'true'})).status,422);
  assert.equal((await writeActivity({...checkpoint,createTask:true})).status,200);
  const {data:withFollowUp}=await (await fetch(appUrl+'/api/state',{headers})).json();
  const task=withFollowUp.tasks.find(item=>item.title===checkpoint.title);
  assert.ok(task?.id);
  assert.equal(task.projectId,project.id);
  assert.equal(withFollowUp.events.filter(item=>item.source==='ثبت دستی'&&item.title===checkpoint.title).length,1);
  assert.equal((await fetch(appUrl+'/api/records/tasks/'+task.id,{headers:viewerHeaders})).status,404);
  console.log(JSON.stringify({ok:true,mode:'production-build-http-postgresql',machineObservation:'scoped-with-disk',
    github:'project-scoped',memory:'scoped-project-and-activity-citations'}));
} finally {
  await stopServer();
  if (existed) await admin.query('DROP DATABASE "' + database + '"');
  if (roleCreated) await admin.query('DROP ROLE "' + runtimeRole + '"');
  await admin.end();
  await rm(scratch,{recursive:true,force:true,maxRetries:4});
}
