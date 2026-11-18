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
  server = fork(resolve('scripts/prepare-e2e.mjs'),[],{env,stdio:['ignore','ignore','pipe','ipc']});
  server.stderr?.resume();
  const appUrl = await new Promise((ok,fail)=>{
    const timeout = setTimeout(()=>fail(new Error('PostgreSQL production build test server not ready')),30_000);
    server.once('exit',()=>{clearTimeout(timeout);fail(new Error('PostgreSQL production build test server exited'));});
    server.once('error',error=>{clearTimeout(timeout);fail(error);});
    server.once('message',message=>{clearTimeout(timeout);ok(message.url);});
  });
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
  const change=await fetch(appUrl+'/api/records',{headers,method:'PATCH',body:JSON.stringify({
    version:0,changes:[{kind:'projects',id:project.id,action:'create',record:project}],
  })});
  assert.equal(change.status,200);
  const response=await fetch(appUrl+'/api/records/projects/'+project.id,{headers});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).record,project);
  assert.equal((await fetch(appUrl+'/api/state')).status,401);
  const pgClient = new pg.Client({connectionString:runtime.href});
  try {
    await pgClient.connect();
    assert.equal((await pgClient.query("SELECT COUNT(*) FROM records WHERE kind='projects'")).rows[0].count,'1');
  } finally { await pgClient.end(); }
  console.log(JSON.stringify({ok:true,mode:'production-build-http-postgresql'}));
} finally {
  if (server && server.exitCode===null && server.signalCode===null) {
    const exited=once(server,'exit');
    server.kill();
    await exited;
  }
  if (existed) await admin.query('DROP DATABASE "' + database + '"');
  await admin.end();
  await rm(scratch,{recursive:true,force:true,maxRetries:4});
}
