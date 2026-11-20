import { expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { totp } from '../src/lib/server/mfa';
import { test, setupToken, testRequest, type Origin } from './isolated-app';

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
function create<T extends {id:string}>(kind:string,record:T) { return {kind,id:record.id,action:'create',record}; }

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
  const member=await testRequest(appURL);
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
    const other=await testRequest(appURL);
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

test('project form waits for the server commit before navigation and persists after reload',async({page,origin})=>{
  await bootstrap(page.request,origin);
  await page.goto('/projects');
  await page.getByRole('button',{name:'پروژه جدید',exact:true}).click();
  const name='پروژهٔ آزمایشی از فرم';
  await page.getByLabel('نام پروژه').fill(name);
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/records',async route=>{await pending;await route.continue();});
  const submit=page.getByRole('button',{name:'ایجاد پروژه',exact:true});
  try {
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText('پروژه ایجاد شد.',{exact:true})).toHaveCount(0);
  } finally { release(); }
  await expect(page).toHaveURL(/\/projects\/project-/);
  await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible();
});

test('only an empty archived project can be deleted from its page', async ({page, origin}) => {
  await bootstrap(page.request, origin);
  const shared = {id:'shared-vps', name:'Shared VPS', projectId:'hosting', linkedProjectIds:['protected'],
    type:'server', address:'203.0.113.24', environment:'Staging', status:'registered', provider:'Fixture host', tags:[]};
  const setup = await page.request.patch('/api/records', {headers:origin, data:{version:0, changes:[
    create('projects', project('hosting')), create('projects', project('protected')), create('projects', project('empty')),
    create('resources', shared),
  ]}});
  expect(setup.status()).toBe(200);

  for (const id of ['protected', 'empty']) {
    await page.goto('/projects/' + id);
    const remove = page.getByRole('button', {name:'حذف پروژه', exact:true});
    await expect(remove).toHaveCount(0);
    await page.getByRole('button', {name:'بایگانی پروژه', exact:true}).click();
    await page.getByRole('button', {name:'تأیید بایگانی', exact:true}).click();
    await expect(remove).toBeVisible();
    await remove.click();
    const dialog = page.getByRole('dialog', {name:'حذف پروژه'});
    await dialog.getByRole('button', {name:'تأیید حذف پروژه', exact:true}).click();
    if (id === 'protected') {
      await expect(dialog.getByRole('alert')).toContainText('حذف تأیید نشد');
      expect((await page.request.get('/api/records/projects/protected')).status()).toBe(200);
      expect((await page.request.get('/api/records/resources/shared-vps')).status()).toBe(200);
      await dialog.getByRole('button', {name:'انصراف', exact:true}).click();
    } else {
      await expect(page).toHaveURL(/\/projects$/);
      expect((await page.request.get('/api/records/projects/empty')).status()).toBe(404);
    }
  }
});

test('a resource renewal charge retains its currency and links after a rejected write and retry', async ({page, origin}) => {
  await bootstrap(page.request, origin);
  const domain = {id:'domain', name:'Domain renewal fixture', projectId:'hosting', linkedProjectIds:['billing'],
    type:'domain', address:'domain.example.test', environment:'Staging', status:'registered', provider:'Fixture host',
    expires:'2027-04-01', tags:[]};
  const setup = await page.request.patch('/api/records', {headers:origin, data:{version:0, changes:[
    create('projects', project('hosting')), create('projects', project('billing')),
    create('resources', domain), create('resources', {...domain, id:'late', name:'Later renewal', linkedProjectIds:[], expires:'2027-05-01'}),
  ]}});
  expect(setup.status()).toBe(200);
  expect((await page.request.get('/api/records/resources/domain')).status()).toBe(200);

  await page.goto('/finance');
  await page.getByRole('button', {name:'ثبت اشتراک دوره‌ای', exact:true}).click();
  const form = page.getByRole('dialog', {name:'ثبت اشتراک دوره‌ای'});
  await form.getByLabel('پروژه', {exact:true}).selectOption('billing');
  await expect(form.getByLabel('منبع مرتبط').getByRole('option', {name:'Later renewal', exact:true})).toHaveCount(0);
  await form.getByLabel('منبع مرتبط').selectOption('domain');
  await form.getByLabel('عنوان', {exact:true}).fill('آزمون هزینه دامنه');
  await form.getByLabel('ارائه‌دهنده').fill('Fixture host');
  await form.getByLabel('واحد ارز').selectOption('USD');
  const amount = form.getByLabel('مبلغ (دلار تا دو رقم اعشار)', {exact:true});
  await amount.fill('12.50');
  await form.getByLabel('موعد بعدی (میلادی)').fill('2027-04-01');
  await page.route('**/api/records', route => route.fulfill({status:422, json:{error:'Synthetic validation rejection'}}), {times:1});
  const submit = form.getByRole('button', {name:'ثبت اشتراک دوره‌ای', exact:true});
  await submit.click();
  await expect(form.getByRole('alert')).toContainText('ثبت اطلاعات مالی تأیید نشد');
  await expect(amount).toHaveValue('12.50');
  await submit.click();
  await expect(form).toHaveCount(0);

  const result = await page.request.get('/api/state');
  expect(result.status()).toBe(200);
  const snapshot = await result.json();
  expect(snapshot.data.charges).toEqual([expect.objectContaining({
    amount:1250, amountUnit:'minor', currency:'USD', projectId:'billing', linkedResourceId:'domain', nextDue:'2027-04-01',
  })]);
  const unrelated = await page.request.patch('/api/records', {headers:origin, data:{version:snapshot.version, changes:[
    create('charges', {...snapshot.data.charges[0], id:'unrelated-resource', linkedResourceId:'late'}),
  ]}});
  expect(unrelated.status()).toBe(422);
  const legacyPayload = {...snapshot.data, charges:[...snapshot.data.charges,
    {...snapshot.data.charges[0], id:'unrelated-resource', linkedResourceId:'late'}]};
  expect((await page.request.put('/api/state', {headers:origin, data:{version:snapshot.version, data:legacyPayload}})).status()).toBe(422);
  expect((await page.request.get('/api/records/charges/unrelated-resource')).status()).toBe(404);
  await page.goto('/infrastructure');
  await page.getByLabel('مرتب‌سازی منابع').selectOption('renewal');
  const first = page.getByRole('table', {name:'منابع زیرساخت'}).locator('tbody tr').first();
  await expect(first.getByText('Domain renewal fixture', {exact:true})).toBeVisible();
  await first.getByText('Domain renewal fixture', {exact:true}).click();
  const metadata = page.getByRole('dialog', {name:'Domain renewal fixture'});
  await expect(metadata.getByText(/آزمون هزینه دامنه.*۱۲٫۵۰ دلار/)).toBeVisible();
});

test('a viewer keeps access to the charge after resource sharing is revoked without seeing the resource reference', async ({request, origin, appURL}) => {
  await bootstrap(request, origin);
  const domain = {id:'domain', name:'Domain fixture', projectId:'hosting', linkedProjectIds:['billing'],
    type:'domain', address:'domain.example.test', environment:'Staging', status:'registered', provider:'Fixture host', tags:[]};
  const charge = {id:'charge', projectId:'billing', title:'Fixture charge', provider:'Fixture host',
    amount:1250, amountUnit:'minor', currency:'USD', nextDue:'2027-04-01', period:'yearly', status:'active', linkedResourceId:'domain'};
  const seed = await request.patch('/api/records', {headers:origin, data:{version:0, changes:[
    create('projects', project('hosting')), create('projects', project('billing')),
    create('resources', domain), create('charges', charge),
  ]}});
  expect(seed.status()).toBe(200);
  const memberEmail = 'billing-viewer@example.test';
  const invitation = await request.post('/api/team/invitations', {headers:origin,
    data:{email:memberEmail, role:'viewer', projectIds:['billing']}});
  expect(invitation.status()).toBe(200);
  const viewer = await testRequest(appURL);
  try {
    const accepted = await viewer.post('/api/auth/accept-invite', {headers:origin,
      data:{token:(await invitation.json()).token, email:memberEmail, password, displayName:'Billing viewer'}});
    expect(accepted.status()).toBe(200);
    const readCharge = () => viewer.get('/api/records/charges/charge');
    const first = await readCharge();
    expect(first.status()).toBe(200);
    expect((await first.json()).record.linkedResourceId).toBe('domain');
    const changed = await request.patch('/api/records', {headers:origin, data:{version:(await seed.json()).version,
      changes:[{kind:'resources', id:'domain', action:'replace', record:{...domain, linkedProjectIds:[]}}]}});
    expect(changed.status()).toBe(200);
    const remaining = await readCharge();
    expect(remaining.status()).toBe(200);
    expect((await remaining.json()).record).toEqual(expect.objectContaining({amount:1250, currency:'USD'}));
    expect((await remaining.json()).record).not.toHaveProperty('linkedResourceId');
    expect((await viewer.get('/api/records/resources/domain')).status()).toBe(404);
    const owner = await request.get('/api/records/charges/charge');
    expect((await owner.json()).record.linkedResourceId).toBe('domain');
  } finally { await viewer.dispose(); }
});

test('secure login and the three-step onboarding save a real workspace and its optional starter task', async ({page, origin, appURL}) => {
  const setup = await testRequest(appURL);
  try { await bootstrap(setup, origin); }
  finally { await setup.dispose(); }
  await page.goto('/login');
  await page.getByLabel('ایمیل', {exact:true}).fill(email);
  const passwordField = page.getByLabel('رمز عبور', {exact:true});
  await passwordField.fill('synthetic-invalid-onboarding-credential');
  const login = page.getByRole('button', {name:'ورود امن', exact:true});
  await login.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('ایمیل یا رمز معتبر نیست');
  await expect(page).toHaveURL('/login');
  await passwordField.fill(password);
  await login.click();
  await expect(page).toHaveURL('/dashboard');
  expect(await page.evaluate(() => JSON.stringify({...localStorage,...sessionStorage}))).not.toContain(password);
  await page.getByRole('button', {name:'حساب کاربری'}).click();
  await page.getByRole('link', {name:'راه‌اندازی فضای کاری'}).click();
  const workspace = 'فضای شروع آزمایشی';
  const firstProject = 'پروژهٔ آغاز آزمایشی';
  await page.getByLabel('نام فضای کاری').fill(workspace);
  await page.getByRole('button', {name:'ادامه و افزودن پروژه'}).click();
  await page.getByLabel('نام پروژه').fill(firstProject);
  const starter = page.getByRole('checkbox', {name:'افزودن یک وظیفهٔ نمونه'});
  await expect(starter).not.toBeChecked();
  await starter.check();
  await page.getByRole('button', {name:'مرور اطلاعات'}).click();
  await expect(page.getByRole('heading', {name:'بازبینی و ساخت فضای کاری'})).toBeVisible();
  await page.getByRole('button', {name:'ایجاد پروژه', exact:true}).click();
  await expect(page.getByRole('heading', {level:1, name:firstProject})).toBeVisible();
  await expect(page.getByRole('link', {name:/مرور برنامه تحویل/})).toBeVisible();
  const snapshot = await page.request.get('/api/state');
  expect(snapshot.status()).toBe(200);
  const {data} = await snapshot.json();
  expect(data.preferences.workspace).toBe(workspace);
  expect(data.tasks).toEqual([expect.objectContaining({title:'مرور برنامه تحویل', owner:data.users[0].id})]);
});

test('owners can attach Vault metadata to a VPS and other roles cannot retrieve it', async ({page, origin, appURL}) => {
  await bootstrap(page.request, origin);
  const vps = {id:'nas-vps', name:'Synthetic VPS', projectId:'primary', linkedProjectIds:[], type:'server',
    address:'203.0.113.5', environment:'Development', status:'registered', provider:'Fixture host', tags:[]};
  const seed = await page.request.patch('/api/records', {headers:origin, data:{version:0, changes:[
    create('projects', project('primary')), create('projects', project('unrelated')), create('resources', vps),
  ]}});
  expect(seed.status()).toBe(200);
  await page.goto('/infrastructure/servers/nas-vps');
  await page.getByRole('link', {name:'ارجاع‌های خزانهٔ این سرور'}).click();
  await expect(page).toHaveURL('/vault?resource=nas-vps');
  await page.getByRole('button', {name:'افزودن ارجاع', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'افزودن ارجاع'});
  await expect(dialog.getByLabel('منبع مرتبط')).toHaveValue('nas-vps');
  await dialog.getByLabel('عنوان ارجاع').fill('کلید آزمون VPS');
  await dialog.getByLabel('محل خزانه').fill('HashiCorp Vault');
  await dialog.getByLabel('Mount فراداده برای HashiCorp Vault').fill('synthetic-kv');
  const save = dialog.getByRole('button', {name:'ثبت ارجاع', exact:true});
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('مسیر فراداده');
  await dialog.getByLabel('مسیر فراداده برای HashiCorp Vault').fill('test/ssh');
  await save.click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', {name:'کلید آزمون VPS', exact:true}).click();
  const details = page.getByRole('dialog', {name:'جزئیات ارجاع'});
  await expect(details.getByText('test/ssh', {exact:true})).toBeVisible();
  await expect(details.getByRole('status')).toHaveText('اتصال تنظیم نشده');

  const data = await (await page.request.get('/api/state')).json();
  const [reference] = data.data.secrets;
  expect(reference).toEqual(expect.objectContaining({resourceId:'nas-vps', vaultMount:'synthetic-kv', vaultPath:'test/ssh'}));
  const check = '/api/vault/' + reference.id;
  expect((await page.request.post(check, {headers:origin, data:{password:'invalid-fixture-password'}})).status()).toBe(403);
  const confirmed = await page.request.post(check, {headers:origin, data:{password}});
  expect(confirmed.status()).toBe(200);
  expect(await confirmed.json()).toEqual({status:'not_configured', checkedAt:null, providerVersion:null});
  const saveChanges = (changes:unknown[]) => page.request.patch('/api/records', {headers:origin, data:{version:data.version, changes}});
  expect((await saveChanges([create('secrets', {...reference, id:'unrelated-ref', projectId:'unrelated'})])).status()).toBe(422);
  expect((await saveChanges([create('secrets', {...reference, id:'raw-ref', rawValue:'synthetic-fixture-only'})])).status()).toBe(422);
  expect((await saveChanges([{kind:'resources', id:vps.id, action:'delete'}])).status()).toBe(422);

  const memberEmail = 'vault-viewer@example.test';
  const member = await testRequest(appURL);
  try {
    const invitation = await page.request.post('/api/team/invitations', {headers:origin,
      data:{email:memberEmail, role:'viewer', projectIds:['primary']}});
    expect(invitation.status()).toBe(200);
    const accepted = await member.post('/api/auth/accept-invite', {headers:origin,
      data:{token:(await invitation.json()).token, email:memberEmail, password, displayName:'Scoped viewer'}});
    expect(accepted.status()).toBe(200);
    expect((await member.get('/api/records/resources/nas-vps')).status()).toBe(200);
    expect((await member.get(check)).status()).toBe(404);
    expect((await member.get('/api/records/secrets/' + reference.id)).status()).toBe(404);
    expect((await (await member.get('/api/state')).json()).data.secrets).toEqual([]);
  } finally { await member.dispose(); }
});

test('workspace overlay triggers become available when browser scripts are ready', async ({page, origin}) => {
  await bootstrap(page.request, origin);
  let releaseScripts!: () => void;
  const ready = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => {
    await ready;
    await route.continue();
  });
  const account = page.getByRole('button', {name:'حساب کاربری', exact:true});
  try {
    await page.goto('/dashboard', {waitUntil:'commit'});
    await expect(account).toBeDisabled();
  } finally { releaseScripts(); }
  await expect(account).toBeEnabled();
  await account.click();
  await expect(page.getByRole('dialog', {name:'حساب کاربری'})).toBeVisible();
});
