import { expect, request as requests, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { totp } from '../src/lib/server/mfa';
import { test, setupToken, type Origin } from './isolated-app';

const email='release-owner@example.test', password='synthetic-release-test-password';
const credentials={email,password};
function project(id:string) {
  return {id,name:id,subtitle:'',coverTitle:id,description:'',status:'building',type:'Website',
    progress:0,next:'',art:'navigation/projects'};
}
function task(id:string, projectId:string) {
  return {id,projectId,title:id,status:'todo',priority:'medium',owner:'Test',due:'2026-11-20',description:'',
    checklist:[],comments:[],dependencies:[]};
}
function doc(id:string,projectId:string,title:string) {
  return {id,projectId,title,type:'Runbook',body:'داشبورد و راهنمای مصنوعی',revision:1,updated:'2026-11-18'};
}
function create(kind:string,record:{id:string}) { return {kind,id:record.id,action:'create',record}; }

async function bootstrap(context:APIRequestContext,origin:Origin) {
  const response=await context.post('/api/auth/setup',{headers:origin,data:{
    setupToken,email,password,displayName:'QA owner',workspace:'Release QA',
  }});
  expect(response.status()).toBe(200);
}
async function seed(request:APIRequestContext,origin:Origin) {
  const changes=[create('projects',project('visible')),create('projects',project('private')),
    create('tasks',task('t-one','visible')),create('tasks',task('t-two','visible')),
    create('docs',doc('open-doc','visible','داشبورد عمومی پروژه')),create('docs',doc('closed-doc','private','داشبورد پروژهٔ محدود'))];
  expect((await request.patch('/api/records',{headers:origin,data:{version:0,changes}})).status()).toBe(200);
}

test('record concurrency preserves independent edits and rejects a partial transaction',async({request,origin})=>{
  await bootstrap(request,origin);
  await seed(request,origin);
  const version=(await (await request.get('/api/state')).json()).version;
  const edit=(id:string,description:string)=>({kind:'tasks',id,action:'replace',record:{...task(id,'visible'),description}});
  const commit=(changes:unknown[])=>request.patch('/api/records',{headers:origin,data:{version,changes}});
  const writes=await Promise.all([commit([edit('t-one','first')]),commit([edit('t-two','second')])]);
  expect(writes.map(response=>response.status())).toEqual([200,200]);
  expect((await commit([edit('t-one','stale')])).status()).toBe(409);
  const updated=(await (await request.get('/api/state')).json());
  expect(updated.data.tasks.map((row:{description:string})=>row.description).sort()).toEqual(['first','second']);
  const rejected=await request.patch('/api/records',{headers:origin,data:{version:updated.version,changes:[
    create('projects',project('rollback')),create('tasks',task('broken','unknown-project')),
  ]}});
  expect(rejected.status()).toBe(422);
  expect((await request.get('/api/records/projects/rollback')).status()).toBe(404);
  expect((await (await request.get('/api/state')).json()).version).toBe(updated.version);
});

test('project grants govern snapshots, direct record reads, document history and memory retrieval',async({request,origin,appURL})=>{
  await bootstrap(request,origin);
  await seed(request,origin);
  const memberEmail='limited-editor@example.test';
  const invite=await request.post('/api/team/invitations',{headers:origin,data:{email:memberEmail,role:'editor',projectIds:['visible']}});
  expect(invite.status()).toBe(200);
  const member=await requests.newContext({baseURL:appURL});
  try {
    const accepted=await member.post('/api/auth/accept-invite',{headers:origin,data:{
      token:(await invite.json()).token,email:memberEmail,password,displayName:'Limited editor',
    }});
    expect(accepted.status()).toBe(200);
    const {data,version}=await (await member.get('/api/state')).json();
    expect(data.projects.map((record:{id:string})=>record.id)).toEqual(['visible']);
    expect(data.docs.map((record:{id:string})=>record.id)).toEqual(['open-doc']);
    expect(data.events.every((event:{projectId:string})=>event.projectId==='visible')).toBe(true);
    expect((await member.get('/api/records/docs/closed-doc')).status()).toBe(404);
    expect((await member.get('/api/docs/history?id=closed-doc')).status()).toBe(404);
    expect((await member.get('/api/docs/history?id=open-doc')).status()).toBe(200);
    const search=await member.post('/api/assistant',{headers:origin,data:{question:'داشبورد',allowExternal:true}});
    expect(search.status()).toBe(200);
    const memory=await search.json();
    expect(memory.externalTransmission).toBe(false);
    expect(memory.citations.map((item:{id:string})=>item.id)).toEqual(['doc:open-doc']);
    expect((await member.post('/api/assistant',{headers:origin,data:{question:'داشبورد',projectId:'private'}})).status()).toBe(404);
    expect((await member.patch('/api/records',{headers:origin,data:{version,changes:[create('tasks',task('blocked','private'))]}})).status()).toBe(403);
    expect((await member.patch('/api/records',{headers:origin,data:{version,changes:[create('tasks',task('allowed','visible'))]}})).status()).toBe(200);
    const ownerState=await (await request.get('/api/state')).json();
    const memberId=ownerState.data.users.find((item:{email:string})=>item.email===memberEmail).id;
    expect((await request.patch('/api/team/members/'+memberId,{headers:origin,data:{projectIds:[]}})).status()).toBe(200);
    expect((await member.get('/api/docs/history?id=open-doc')).status()).toBe(404);
  } finally { await member.dispose(); }
});

test.describe('required second factor',()=>{
  test.use({enforceMfa:true});
  test('enrollment binds to a session and one-time recovery revokes all older sessions',async({request,origin,appURL})=>{
    await bootstrap(request,origin);
    expect((await request.get('/api/state')).status()).toBe(401);
    expect((await (await request.get('/api/auth/me')).json()).enrollmentRequired).toBe(true);
    const start=await request.post('/api/auth/mfa',{headers:origin,data:{action:'start',password}});
    expect(start.status()).toBe(200);
    const {secret}=await start.json();
    const factor=totp(secret);
    const other=await requests.newContext({baseURL:appURL});
    try {
      expect((await other.post('/api/auth/login',{headers:origin,data:credentials})).status()).toBe(200);
      expect((await other.post('/api/auth/mfa',{headers:origin,data:{action:'confirm',code:factor}})).status()).toBe(422);
      const confirm=await request.post('/api/auth/mfa',{headers:origin,data:{action:'confirm',code:factor}});
      expect(confirm.status()).toBe(200);
      const {recoveryCodes}=await confirm.json();
      expect(recoveryCodes).toHaveLength(10);
      expect((await request.get('/api/state')).status()).toBe(200);
      expect((await other.get('/api/state')).status()).toBe(401);
      const recovery={...credentials,recoveryCode:recoveryCodes[0]};
      expect((await other.post('/api/auth/login',{headers:origin,data:recovery})).status()).toBe(200);
      expect((await request.get('/api/state')).status()).toBe(401);
      expect((await request.post('/api/auth/login',{headers:origin,data:recovery})).status()).toBe(401);
      expect((await other.post('/api/auth/logout',{headers:origin})).status()).toBe(200);
      expect((await other.get('/api/state')).status()).toBe(401);
    } finally { await other.dispose(); }
  });
});

test('login and authenticated dashboard pass automated WCAG A/AA checks',async({page,origin})=>{
  const login=await page.goto('/login');
  expect(await login?.headerValue('content-security-policy')).toMatch(/script-src[^;]*'nonce-/);
  await expect(page.locator('html')).toHaveAttribute('lang','fa');
  async function violations() {
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    return result.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}));
  }
  expect(await violations()).toEqual([]);
  await bootstrap(page.request,origin);
  await page.goto('/dashboard');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  expect(await violations()).toEqual([]);
});

test('authenticated read performance on a controlled synthetic workspace',async({request,origin},testInfo)=>{
  await bootstrap(request,origin);
  expect((await request.patch('/api/records',{headers:origin,data:{
    version:0,changes:[create('projects',project('perf')), ...Array.from({length:60},(_,i)=>create('tasks',task('perf-'+i,'perf')))],
  }})).status()).toBe(200);
  expect((await request.get('/api/state')).ok()).toBe(true);
  const durations:number[]=[];
  for(let batch=0;batch<10;batch++){
    await Promise.all(Array.from({length:5},async()=>{
      const before=performance.now();
      const result=await request.get('/api/state');
      expect(result.status()).toBe(200);
      expect((await result.json()).data.tasks).toHaveLength(60);
      durations.push(performance.now()-before);
    }));
  }
  durations.sort((a,b)=>a-b);
  const p95=durations[Math.ceil(durations.length*0.95)-1];
  await testInfo.attach('api-p95',{contentType:'application/json',body:JSON.stringify({requests:50,concurrency:5,records:61,p95Ms:p95})});
  console.log(JSON.stringify({requests:50,concurrency:5,records:61,p95Ms:Math.round(p95)}));
  expect(p95).toBeLessThan(2000);
});
