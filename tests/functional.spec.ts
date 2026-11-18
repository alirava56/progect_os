import {randomUUID} from 'node:crypto';
import {expect,request as isolatedRequest, type APIRequestContext} from '@playwright/test';
import {test, setupToken, type Origin} from './isolated-app';
import {routes} from './routes';
const credentials={email:'e2e.owner@example.test',password:'test-password-for-e2e-only-2026'};
async function createProject(request:APIRequestContext, origin:Origin, name='پروژه ماندگار'){
  const id=randomUUID();
  const current=await request.get('/api/state');
  expect(current.status()).toBe(200);
  const {version}=await current.json();
  const record={id,name,subtitle:'',coverTitle:name,description:'',status:'building',type:'وب‌سایت',progress:0,next:'',art:'navigation/projects'};
  const saved=await request.post(`/api/records/projects/${id}`,{headers:origin,data:{version,record}});
  expect(saved.status()).toBe(200);
  return id;
}
test.beforeEach(async({appURL,origin})=>{
  const guest=await isolatedRequest.newContext({baseURL:appURL});
  try {
    const response=await guest.post('/api/auth/setup',{headers:origin,data:{
      setupToken,email:credentials.email,password:credentials.password,
      displayName:'E2E Owner',workspace:'E2E Workspace'
    }});
    expect(response.status()).toBe(200);
  } finally {
    await guest.dispose();
  }
});
const authenticated = test.extend<{ signedIn: APIRequestContext }>({
  signedIn: async ({request,origin}, provide) => {
    const response=await request.post('/api/auth/login',{headers:origin,data:credentials});
    expect(response.status()).toBe(200);
    await provide(request);
  },
});
async function signInBrowser(request:APIRequestContext,origin:Origin){
  const response=await request.post('/api/auth/login',{headers:origin,data:credentials});
  expect(response.status()).toBe(200);
}
test('session authentication and workspace persistence across refresh',async({page,origin})=>{
  await signInBrowser(page.request,origin);
  await page.goto('/dashboard');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const projectId=randomUUID();
  const initial=await page.request.get('/api/state');expect(initial.ok()).toBe(true);
  const payload=await initial.json();
  const newProject={id:projectId,name:'پروژه ماندگار',subtitle:'',coverTitle:'پروژه ماندگار',description:'',status:'building',type:'وب‌سایت',progress:0,next:'',art:'navigation/projects'};
  const changed={...payload.data,projects:[...payload.data.projects,newProject]};
  const saved=await page.request.put('/api/state',{headers:origin,data:{data:changed,version:payload.version}});
  expect(saved.status()).toBe(200);
  await page.reload();
  const after=await page.request.get('/api/state');
  expect((await after.json()).data.projects.some((p:{id:string})=>p.id===projectId)).toBe(true);
});
authenticated('strict revision conflict and invalid date are rejected',async({signedIn,origin})=>{
  const projectId=await createProject(signedIn,origin);
  const response=await signedIn.get('/api/state');
  const {data,version}=await response.json();
  const stale=await signedIn.put('/api/state',{headers:origin,data:{version:version-1,data}});
  expect(stale.status()).toBe(version>0?409:400);
  const task={id:'invalid-day',title:'Bad date',projectId,status:'todo',priority:'medium',owner:'E2E',due:'2026-02-30',description:'',checklist:[],comments:[],dependencies:[]};
  const invalid=await signedIn.put('/api/state',{headers:origin,data:{version,data:{...data,tasks:[...data.tasks,task]}}});
  expect(invalid.status()).toBe(422);
});
authenticated('CSRF and unauthorized mutations fail closed',async({signedIn,appURL})=>{
  const current=await signedIn.get('/api/state');const payload=await current.json();
  const cross=await signedIn.put('/api/state',{headers:{Origin:'https://evil.example','Sec-Fetch-Site':'cross-site'},data:payload});
  expect(cross.status()).toBe(403);
  const guest=await isolatedRequest.newContext({baseURL:appURL});
  try{
    expect((await guest.get('/api/state')).status()).toBe(401);
  }finally{await guest.dispose();}
});
test('responsive authenticated page routes render without horizontal overflow',async({page,origin})=>{
  await signInBrowser(page.request,origin);
  const projectId=await createProject(page.request,origin);
  const taskId=randomUUID(),serverId=randomUUID();
  for(const [kind,record] of [
    ['tasks',{id:taskId,projectId,title:'Responsive test task',status:'todo',priority:'medium',owner:'E2E',due:'2026-11-20',description:'',checklist:[],comments:[],dependencies:[]}],
    ['resources',{id:serverId,projectId,name:'Responsive test server',type:'server',address:'192.0.2.1',environment:'Development',status:'registered',provider:'E2E',tags:[],linkedProjectIds:[]}],
  ] as const){
    const {version}=await (await page.request.get('/api/state')).json();
    const saved=await page.request.post(`/api/records/${kind}/${record.id}`,{headers:origin,data:{version,record}});
    expect(saved.status()).toBe(200);
  }
  const details:Record<string,string>={project:`/projects/${projectId}`,server:`/infrastructure/servers/${serverId}`,task:`/tasks/${taskId}`};
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const [path,key] of routes.filter(([,key])=>key!=='login')){
      const route=details[key]??path;
      await test.step(`${width}px ${route}`,async()=>{
        const result=await page.goto(route);
        expect(result?.ok()).toBe(true);
        expect(new URL(page.url()).pathname).toBe(route);
        await expect(page.locator('html')).toHaveAttribute('lang','fa');
        await expect(page.locator('html')).toHaveAttribute('dir','rtl');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
      });
    }
  }
});


authenticated('free-text credential patterns and fractional expenses are rejected at HTTP boundary',async({signedIn,origin})=>{
  const projectId=await createProject(signedIn,origin);
  const current=await signedIn.get('/api/state');const {data,version}=await current.json();
  const doc={id:'secrets-negative',title:'Runbook',projectId,type:'Runbook',body:'password: superSecret123456',revision:1,updated:'2026-11-18'};
  const rejected=await signedIn.put('/api/state',{headers:origin,data:{version,data:{...data,docs:[...data.docs,doc]}}});
  expect(rejected.status()).toBe(422);
  const badExpense={id:'fractional-negative',title:'Test',projectId,category:'زیرساخت',amount:123.45,date:'2026-11-18',status:'paid'};
  const fractional=await signedIn.put('/api/state',{headers:origin,data:{version,data:{...data,expenses:[...data.expenses,badExpense]}}});
  expect(fractional.status()).toBe(422);
});

authenticated('session revoke-others requires reauthentication and leaves current browser active',async({signedIn,origin})=>{
  const before=await signedIn.get('/api/auth/sessions');expect(before.status()).toBe(200);
  const invalid=await signedIn.post('/api/auth/sessions',{headers:origin,data:{action:'revokeOthers',password:'wrong-password'}});
  expect(invalid.status()).toBe(403);
  const valid=await signedIn.post('/api/auth/sessions',{headers:origin,data:{action:'revokeOthers',password:credentials.password}});
  expect(valid.status()).toBe(200);
  expect((await signedIn.get('/api/state')).status()).toBe(200);
});

authenticated('invite-only Viewer has scoped read access but cannot write or invite',async({signedIn,origin,appURL})=>{
  const invitation=await signedIn.post('/api/team/invitations',{headers:origin,data:{email:'viewer.e2e@example.test',role:'viewer'}});
  expect(invitation.status()).toBe(200);
  const {token}=await invitation.json();
  const viewer=await isolatedRequest.newContext({baseURL:appURL});
  try{
    const accepted=await viewer.post('/api/auth/accept-invite',{headers:origin,data:{token,email:'viewer.e2e@example.test',displayName:'Viewer E2E',password:'viewer-secure-password-2026'}});
    expect(accepted.status()).toBe(200);
    const state=await viewer.get('/api/state');expect(state.status()).toBe(200);
    const {data,version}=await state.json();
    expect((await viewer.put('/api/state',{headers:origin,data:{version,data}})).status()).toBe(403);
    expect((await viewer.post('/api/team/invitations',{headers:origin,data:{email:'intruder@example.test',role:'editor'}})).status()).toBe(403);
    expect((await viewer.post('/api/records/tasks/unauthorized',{headers:origin,data:{version,record:{id:'unauthorized'}}})).status()).toBe(403);
  }finally{await viewer.dispose();}
});

authenticated('Editor can modify tasks but not infrastructure or workspace preferences',async({signedIn,origin,appURL})=>{
  const projectId=await createProject(signedIn,origin);
  const invitation=await signedIn.post('/api/team/invitations',{headers:origin,data:{email:'editor.e2e@example.test',role:'editor'}});
  expect(invitation.status()).toBe(200);
  const {token}=await invitation.json();
  const editor=await isolatedRequest.newContext({baseURL:appURL});
  try{
    const accepted=await editor.post('/api/auth/accept-invite',{headers:origin,data:{token,email:'editor.e2e@example.test',displayName:'Editor E2E',password:'editor-secure-password-2026'}});
    expect(accepted.status()).toBe(200);
    const state=await editor.get('/api/state');const {version}=await state.json();
    const task={id:'editor-e2e-task',title:'Editor task',projectId,status:'todo',priority:'medium',owner:'Editor',due:'2026-11-20',description:'Safe',checklist:[],comments:[],dependencies:[]};
    const created=await editor.post('/api/records/tasks/editor-e2e-task',{headers:origin,data:{version,record:task}});
    expect(created.status()).toBe(200);
    const nextVersion=(await created.json()).version;
    const denied=await editor.post('/api/records/resources/srv-denied',{headers:origin,data:{version:nextVersion,record:{id:'srv-denied'}}});
    expect(denied.status()).toBe(403);
    const current=await editor.get('/api/state');const {data}=await current.json();
    expect((await editor.put('/api/state',{headers:origin,data:{version:nextVersion,data}})).status()).toBe(403);
  }finally{await editor.dispose();}
});

authenticated('Vault reference metadata is visible only to Owners on state and record reads',async({signedIn,origin,appURL})=>{
  const projectId=await createProject(signedIn,origin);
  const {version}=await (await signedIn.get('/api/state')).json();
  const id=randomUUID();
  const path=`/api/records/secrets/${id}`;
  const record={id,projectId,name:'E2E vault reference',type:'SSH Key',vaultProvider:'1Password',externalRef:'https://start.1password.com/open/i?i=synthetic'};
  expect((await signedIn.post(path,{headers:origin,data:{version,record}})).status()).toBe(200);
  expect((await (await signedIn.get(path)).json()).record).toMatchObject(record);
  for(const role of ['viewer','editor']){
    const email=`${role}-${randomUUID()}@example.test`;
    const invitation=await signedIn.post('/api/team/invitations',{headers:origin,data:{email,role}});
    expect(invitation.status()).toBe(200);
    const {token}=await invitation.json();
    const member=await isolatedRequest.newContext({baseURL:appURL});
    try{
      const response=await member.post('/api/auth/accept-invite',{headers:origin,data:{
        token,email,displayName:'E2E member',password:'member-test-password-only-2026',
      }});
      expect(response.status()).toBe(200);
      const state=await member.get('/api/state');
      expect(state.status()).toBe(200);
      const {data,version:memberVersion}=await state.json();
      expect(data.secrets).toEqual([]);
      expect(data.events.some((event:{title:string})=>event.title===record.name)).toBe(false);
      expect((await member.get(path)).status()).toBe(404);
      const vaultPage=await member.get('/vault');
      expect(vaultPage.status()).toBe(200);
      expect(await vaultPage.text()).not.toContain(record.externalRef);
      if(role==='editor'){
        const task={id:randomUUID(),projectId,title:'Editor task with hidden Vault references',status:'todo',priority:'medium',owner:'Editor',due:'2026-11-20',description:'',checklist:[],comments:[],dependencies:[]};
        const edit=await member.post(`/api/records/tasks/${task.id}`,{
          headers:origin,data:{version:memberVersion,record:task},
        });
        expect(edit.status()).toBe(200);
        expect((await (await signedIn.get(path)).json()).record).toMatchObject(record);
      }
    }finally{await member.dispose();}
  }
});
