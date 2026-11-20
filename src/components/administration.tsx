'use client';
import {useRouter} from 'next/navigation';
import Link from 'next/link';

import { useEffect, useState, type FormEvent } from 'react';
import { Download, KeyRound, Mail, Pencil, Plug2, Plus, ShieldCheck, UserRound, Users } from 'lucide-react';
import { download } from '@/lib/format';
import { savePreferences, useDemo, useWorkspaceReady } from '@/lib/store';
import type { Integration, Preferences } from '@/lib/types';
import { Art, Button, Callout, Field, Heading, Metrics, Modal, Panel, Pill, Row, Switch, Table } from './ui';

export function Integrations() {
  const { data } = useDemo();
  const [selected,setSelected] = useState<Integration>();
  const [catalog,setCatalog] = useState(false);
  const [github,setGithub]=useState<{status:string;repositories:Array<{repository:string;projectId:string;state:string;openIssues?:number;checkedAt?:string|null;latestDeployment?:{state:string}|null}>}|null>(null);
  const [syncing,setSyncing]=useState(false);
  const [syncMessage,setSyncMessage]=useState('');
  async function sync(repository:string,projectId:string,backfill=false){
    setSyncing(true);setSyncMessage('');
    try{
      const result=await fetch('/api/integrations/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repository,projectId,backfill})});
      if(!result.ok)throw new Error(result.status===429?'محدودیت نرخ GitHub. پس از وقفهٔ اعلام‌شده دوباره تلاش کنید.':'همگام‌سازی در دسترس نیست.');
      const current=await result.json();
      setGithub(value=>value?{...value,repositories:value.repositories.map(repo=>repo.projectId===projectId&&repo.repository===repository?current:repo)}:value);
    }catch(error){setSyncMessage(error instanceof Error?error.message:'همگام‌سازی در دسترس نیست.');}
    finally{setSyncing(false);}
  }
  useEffect(()=>{
    let active=true;
    fetch('/api/integrations/github',{cache:'no-store'}).then(r=>r.ok?r.json():null)
      .then(payload=>{if(active&&payload)setGithub(payload);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  return <>
    <Heading title="اتصال‌ها و یکپارچه‌سازی" subtitle="ابزارهای توسعه، پایش و خزانه دسترسی‌ها">
      <Button variant="primary" icon={Plus} onClick={() => setCatalog(true)}>اتصال جدید</Button>
    </Heading>
    <div className="stack">
      <div className="grid-3">{data.integrations.map(i => <Panel className="integration-card" key={i.id}>
        <div className="flex items-center justify-between gap-2"><Art name={i.art} size={52} /><Pill tone={i.id==='github'&&github?.repositories.some(r=>r.state==='connected')?'good':'neutral'} dot>{i.id==='github'&&github?.repositories.some(r=>r.state==='connected')?'داده تأییدشده GitHub':'متصل نیست'}</Pill></div>
        <h2><bdi>{i.name}</bdi></h2><p className="muted">{i.description}</p>
        <div className="integration-end"><Button onClick={() => setSelected(i)} icon={Plug2}>جزئیات اتصال</Button><small className="muted" dir="ltr">{i.protocol}</small></div>
      </Panel>)}</div>
      {github?.repositories?.length? <div id="github-repositories"><Panel title="GitHub · آخرین بررسی API">{github.repositories.map(repo=><Row key={repo.projectId+':'+repo.repository} icon={Plug2} title={<bdi dir="ltr">{repo.repository}</bdi>}
        meta={repo.state==='connected'?`اقلام باز: ${repo.openIssues??'نامشخص'} · بررسی: ${repo.checkedAt?new Date(repo.checkedAt).toLocaleString('fa-IR'):'نامشخص'} · استقرار: ${repo.latestDeployment?.state??'نامشخص'}`:'وضعیت فعلی نامشخص'}
        end={<div className="control-group"><Pill tone={repo.state==='connected'?'good':'warn'}>{repo.state==='connected'?'دریافت موفق':'نامشخص'}</Pill>
          <Button disabled={syncing||github.status!=='configured'} onClick={()=>void sync(repo.repository,repo.projectId)}>همگام‌سازی</Button>
          <Button disabled={syncing||github.status!=='configured'} onClick={()=>void sync(repo.repository,repo.projectId,true)}>دریافت سابقه</Button></div>} />)}
          {syncMessage&&<p role="status">{syncMessage}</p>}</Panel></div>:null}
      <Callout>اتصال خواندنی GitHub فقط پس از تنظیم توکن و فهرست مخازن مجاز روی سرور کار می‌کند. سایر اتصال‌ها فعال نیستند؛ توکن را داخل فرم‌های برنامه وارد نکنید.</Callout>
    </div>
    {catalog && <Modal title="فهرست اتصال‌ها" onClose={() => setCatalog(false)}>
      {data.integrations.map(i => <Row onClick={() => {setCatalog(false);setSelected(i);}} key={i.id} icon={Plug2} title={<bdi>{i.name}</bdi>} meta={i.description} end={<Pill tone="neutral">متصل نیست</Pill>} />)}
    </Modal>}
    {selected && <Modal title={selected.name} onClose={() => setSelected(undefined)}><div className="form-stack">
      <div className="flex items-center justify-between"><Art name={selected.art} size={65} /><Pill tone="neutral">
        {selected.id==='github'&&github?.status==='configured'?'تنظیم شده':'متصل نیست'}
      </Pill></div>
      <p>{selected.description} · <bdi dir="ltr">{selected.protocol}</bdi></p>
      {selected.id==='github' ? <>
        <Callout>مخزن‌ها و دسترسی خواندنی GitHub روی سرور تنظیم می‌شوند.</Callout>
        {!!github?.repositories.length && <a className="cell-link" href="#github-repositories" onClick={()=>setSelected(undefined)}>مشاهدهٔ مخازن</a>}
      </> : <Callout>تنظیم این اتصال از رابط در دسترس نیست.</Callout>}
    </div></Modal>}
  </>;
}

export function Team() {
  const {data}=useDemo();
  const ready=useWorkspaceReady();
  const owner=data.users[0]?.role==='Owner';
  const [email,setEmail]=useState(''),[role,setRole]=useState<'viewer'|'editor'>('viewer');
  const [limited,setLimited]=useState(true);
  const [projectIds,setProjectIds]=useState<string[]>([]);
  const [token,setToken]=useState(''),[invites,setInvites]=useState<Array<{id:string;email:string;role:string;expiresAt:number;redeemedAt:number|null;revokedAt:number|null;active:boolean}>>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function refresh(){
    if(!owner)return;
    try{const res=await fetch('/api/team/invitations',{cache:'no-store'});if(res.ok)setInvites((await res.json()).invitations??[]);}
    catch{setMessage('فهرست دعوت‌ها در دسترس نیست.');}
  }
  useEffect(()=>{if(owner){fetch('/api/team/invitations',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data)setInvites(data.invitations??[]);}).catch(()=>{});}},[owner]);
  async function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage('');setToken('');
    try{
      const res=await fetch('/api/team/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,role,projectIds:limited ? projectIds : null})});
      if(!res.ok)throw Error('دعوت پذیرفته نشد؛ ایمیل یا محدودیت دعوت‌ها را بررسی کن.');
      const value=await res.json();setToken(value.token);setEmail('');await refresh();
      setMessage('دعوت ایجاد شد. کد را فقط از یک کانال خصوصی با فرد موردنظر به اشتراک بگذار.');
    }catch(error){setMessage(error instanceof Error?error.message:'خطا در دعوت');}finally{setBusy(false);}
  }
  async function revoke(id:string){
    setBusy(true);try{
      const res=await fetch('/api/team/invitations',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      if(!res.ok)throw Error('ابطال دعوت ناموفق بود.');await refresh();setToken('');
    }catch(e){setMessage(e instanceof Error?e.message:'خطای ابطال');}finally{setBusy(false);}
  }
  async function remove(id:string){
    if(!window.confirm('دسترسی این عضو و تمام نشست‌های او لغو شود؟'))return;
    setBusy(true);try{
      const res=await fetch(`/api/team/members/${encodeURIComponent(id)}`,{method:'DELETE'});
      if(!res.ok)throw Error('حذف عضو مجاز یا ممکن نیست.');window.location.reload();
    }catch(e){setMessage(e instanceof Error?e.message:'خطای حذف عضو');}finally{setBusy(false);}
  }
  return <>
    <Heading title="کاربران و دسترسی‌ها" subtitle="عضویت‌های تأییدشده و دعوت‌های یک‌بارمصرف Workspace" />
    <div className="stack">
      <Callout>مالک همه رکوردها را مدیریت می‌کند؛ توسعه‌دهنده فقط تسک، مستند، یادآوری و هشدار را ویرایش می‌کند؛ Viewer فقط مشاهده می‌کند. دعوت فقط با کد دستی است و ایمیل خودکار ارسال نمی‌شود.</Callout>
      <Metrics entries={[
        {label:'کاربران مجاز',value:data.users.length,note:'بر اساس عضویت واقعی',icon:Users},
        {label:'مالک',value:data.users.filter(u=>u.role==='Owner').length,note:'دسترسی مدیر',icon:ShieldCheck},
        {label:'دعوت‌های باز',value:invites.filter(i=>i.active).length,note:'اعتبار ۴۸ ساعت',icon:Mail},
      ]}/>
      <Panel title="حساب‌های عضو"><Table label="اعضای واقعی" rows={data.users} columns={[
        {label:'نام',render:u=><strong>{u.name}</strong>},
        {label:'ایمیل',render:u=><bdi dir="ltr">{u.email}</bdi>},
        {label:'نقش',render:u=><Pill>{u.role}</Pill>},
        {label:'کنترل',render:u=>owner&&u.role!=='Owner'?<Button disabled={busy} onClick={()=>remove(u.id)}>لغو عضویت</Button>:<Pill tone="good">فعال</Pill>},
      ]}/></Panel>
      {owner&&<Panel title="دعوت به تیم">
        <form onSubmit={invite}><fieldset className="form-stack" disabled={!ready||busy}>
          <Field label="ایمیل عضو جدید"><input type="email" dir="ltr" required value={email} onChange={e=>setEmail(e.target.value)} /></Field>
          <Field label="سطح دسترسی"><select value={role} onChange={e=>setRole(e.target.value as 'viewer'|'editor')}><option value="viewer">Viewer · مشاهده</option><option value="editor">Developer · ویرایش کارها و اسناد</option></select></Field>
          <Field label="دامنهٔ پروژه‌ها"><select value={limited?'limited':'workspace'} onChange={e=>setLimited(e.target.value==='limited')}>
            <option value="limited">پروژه‌های انتخاب‌شده</option><option value="workspace">همهٔ پروژه‌های فضای کاری</option>
          </select></Field>
          {limited&&<Field label="پروژه‌های مجاز"><select multiple value={projectIds}
            onChange={e=>setProjectIds(Array.from(e.currentTarget.selectedOptions, option=>option.value))}>
            {data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></Field>}
          <Button disabled={busy||!email||(limited&&!projectIds.length)} type="submit" icon={Plus}>ایجاد کد دعوت یک‌بارمصرف</Button>
        </fieldset></form>
        {token&&<div className="form-stack"><Callout>کد زیر تنها همین یک بار نمایش داده می‌شود. گیرنده باید آدرس /join را باز و کد را در فرم وارد کند. آن را در مستندات ProjectOS ذخیره نکن.</Callout><p dir="ltr" className="font-mono break-all select-text">{token}</p><Button onClick={()=>setToken('')}>کد را ذخیره کردم؛ پنهان کن</Button></div>}
        {invites.filter(i=>i.active).map(i=><Row key={i.id} icon={Mail} title={<bdi dir="ltr">{i.email}</bdi>} meta={`نقش: ${i.role} · انقضا: ${new Date(i.expiresAt).toLocaleString('fa-IR')}`} end={<Button disabled={busy} onClick={()=>revoke(i.id)}>ابطال</Button>}/>)}
      </Panel>}
      {message&&<p role="status">{message}</p>}
    </div>
  </>;
}

const preferencesList = [
  {key:'digest',title:'خلاصه روزانه پروژه‌ها',description:'مرور کارهای مهم هر روز'},
  {key:'renewal',title:'هشدارهای زمان‌دار',description:'سررسید سرور، دامنه و قرارداد'},
  {key:'outage',title:'هشدار وضعیت سرویس',description:'ترجیح نمونهٔ پایش سرویس'},
  {key:'stale',title:'وظایف بدون فعالیت',description:'یادآوری برای کارهای نیازمند پیگیری'},
] as const;

export function Settings() {
  const { data } = useDemo();
  return <PreferencesForm key={JSON.stringify(data.preferences)} preferences={data.preferences} />;
}
function PreferencesForm({ preferences }: { preferences: Preferences }) {
  const { data,change,notice } = useDemo();
  const [draft,setDraft] = useState(preferences);
  const [sessions,setSessions] = useState(false);
  const [error,setError] = useState('');
  function write<T extends keyof Preferences>(key: T, value: Preferences[T]) {
    setDraft(previous => ({...previous,[key]:value}));
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspace = draft.workspace.trim();
    const displayName = draft.displayName.trim();
    if (!workspace || !displayName) {setError('نام فضای کاری و نام نمایشی را وارد کنید.');return;}
    const next = {...draft,workspace,displayName};
    const saved = savePreferences(next);
    change(previous => ({...previous,preferences:next}),saved ? 'تنظیمات فضای کاری ذخیره شد.' : 'درخواست ذخیره تنظیمات ارسال شد.');
    setError('');
  }
  return <>
    <Heading title="تنظیمات فضای کاری" subtitle="پروفایل، ظاهر، یادآوری‌ها و ترجیحات عمومی ProjectOS">
      <Button type="submit" form="preferences" variant="primary" icon={Pencil}>ذخیره تغییرات</Button>
    </Heading>
    <div className="split">
      <Panel title="تنظیمات عمومی"><form id="preferences" className="form-stack" onSubmit={save}>
        <div className="form-grid">
          <Field label="نام فضای کاری"><input required value={draft.workspace} maxLength={65} onChange={e => write('workspace',e.target.value)} dir="auto" /></Field>
          <Field label="نام نمایشی"><input required value={draft.displayName} maxLength={60} onChange={e => write('displayName',e.target.value)} dir="auto" /></Field>
          <Field label="ظاهر"><select value={draft.theme} onChange={e => write('theme',e.target.value as Preferences['theme'])}><option value="dark">تیره</option><option value="dim">تیره با کنتراست ملایم</option></select></Field>
          <Field label="زبان رابط و نمایش اعداد شاخص‌ها"><select value={draft.language} onChange={e => write('language',e.target.value as Preferences['language'])}><option value="fa">فارسی · اعداد فارسی</option><option value="fa-latin">فارسی · اعداد لاتین</option></select></Field>
          <Field label="ناحیه زمانی رویدادها"><select dir="ltr" value={draft.zone} onChange={e => write('zone',e.target.value as Preferences['zone'])}><option value="Asia/Tehran">Asia/Tehran</option><option value="UTC">UTC</option></select></Field>
        </div>
        <section><h2 className="section-title mt-3">اعلان‌ها و حریم خصوصی</h2>
          {preferencesList.map(item => <div className="setting-row" key={item.key}><div><strong>{item.title}</strong><small>{item.description}</small></div><Switch label={item.title} checked={draft[item.key]} onChange={checked => write(item.key,checked)} /></div>)}
          <div className="setting-row"><div><strong>نمایش داده‌های محرمانه</strong><small>در نسخه نمایشی در دسترس نیست</small></div><Switch label="نمایش داده‌های محرمانه" checked={false} disabled /></div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form></Panel>
      <Panel title="حساب و امنیت">
        <div className="account-summary"><div className="avatar">A</div><div><strong>{preferences.displayName}</strong><small dir="ltr">{data.users[0]?.email??''}</small></div></div>
        <MfaSettings />
        <Row icon={ShieldCheck} title="نشست‌های فعال" meta="مشاهده تعداد نشست‌ها و ابطال نشست‌های دیگر با احراز هویت مجدد" onClick={() => setSessions(true)} />
        <Row icon={Download} title="صدور تنظیمات رابط" meta="فایل JSON ترجیحات این مرورگر" onClick={() => {
          download('projectos-preferences.json',JSON.stringify(data.preferences,null,2),'application/json');
          notice('خروجی تنظیمات آمادهٔ دانلود است.');
        }} />
        <Callout>تنظیمات خصوصی در دیتابیس نگهداری می‌شوند. کدهای بازیابی MFA فقط یک بار نمایش داده می‌شوند. گذرکلید، فرایند بازیابی مستقل از رمز و مدیریت دستگاه‌های معتبر هنوز کامل نیستند.</Callout>
      </Panel>
    </div>
    {sessions && <SessionsModal onClose={() => setSessions(false)} />}
  </>;
}

export function MfaSettings({enrollmentRequired=false, initiallyEnabled=false}: {enrollmentRequired?:boolean; initiallyEnabled?:boolean} = {}){
  const [status,setStatus]=useState<'unknown'|'enabled'|'disabled'>(initiallyEnabled ? 'enabled' : enrollmentRequired ? 'disabled' : 'unknown');
  const [enroll,setEnroll]=useState<{secret:string;provisioningUrl:string}|null>(null);
  const [recoveryCodes,setRecoveryCodes]=useState<string[]>([]);
  const [remaining,setRemaining]=useState<number|null>(null);
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function readStatus(){
    setBusy(true);try{
      const response=await fetch('/api/auth/mfa',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('دریافت وضعیت ممکن نشد');
      const data=await response.json();setStatus(data.enabled?'enabled':'disabled');setRemaining(data.recoveryCodesRemaining??null);
    }catch{setMessage('وضعیت ورود دومرحله‌ای دریافت نشد.');}finally{setBusy(false);}
  }
  async function start(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/auth/mfa',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'start',password,code})});
      if(!response.ok)throw Error('برای فعال‌سازی، رمز فعلی و کلید رمزنگاری سمت سرور باید معتبر باشند.');
      setEnroll(await response.json());setPassword('');setCode('');
    }catch(e){setMessage(e instanceof Error?e.message:'خطای فعال‌سازی');}finally{setBusy(false);}
  }
  async function confirm(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/auth/mfa',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'confirm',code})});
      const data=await response.json();if(!response.ok||!data.ok)throw Error('کد تأیید معتبر نیست یا مهلت راه‌اندازی منقضی شده است.');
      setEnroll(null);setCode('');setStatus('enabled');setRecoveryCodes(Array.isArray(data.recoveryCodes)?data.recoveryCodes:[]);setRemaining(10);setMessage('ورود دومرحله‌ای فعال شد. کدهای بازیابی را همین الان در یک خزانه امن ذخیره کن.');
    }catch(e){setMessage(e instanceof Error?e.message:'خطای تأیید');}finally{setBusy(false);}
  }
  async function rotateRecovery(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/auth/mfa',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'rotate-recovery',password,code})});
      const result=await response.json();
      if(!response.ok||!result.ok)throw Error('رمز و کد دومرحله‌ای تازه لازم‌اند.');
      setRecoveryCodes(result.recoveryCodes??[]);setRemaining(10);setPassword('');setCode('');
      setMessage('کدهای بازیابی جدید صادر شدند. همه کدهای قبلی باطل‌اند.');
    }catch(error){setMessage(error instanceof Error?error.message:'خطای صدور کد');}
    finally{setBusy(false);}
  }
  return <div className="stack">
    <Row icon={KeyRound} title="ورود دومرحله‌ای (TOTP)" meta={status==='enabled'?'فعال':status==='disabled'?'غیرفعال':'برای بررسی وضعیت کلیک کنید'} end={<Button disabled={busy} onClick={readStatus}>بررسی وضعیت</Button>} />
    {status==='disabled'&&!enroll&&<div className="form-stack">
      <Field label="رمز فعلی برای شروع فعال‌سازی"><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Button disabled={busy||!password} onClick={start}>شروع فعال‌سازی دومرحله‌ای</Button>
    </div>}
    {enroll&&<div className="form-stack">
      <Callout>کلید زیر را فقط در برنامه Authenticator خودت وارد کن؛ آن را در پیام‌رسان، اسکرین‌شات یا مستندات ذخیره نکن. این کلید یک‌بار نمایش داده می‌شود.</Callout>
      <p dir="ltr" className="font-mono break-all select-text">{enroll.secret}</p>
      <Field label="کد شش‌رقمی برنامه Authenticator"><input type="text" value={code} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} onChange={e=>setCode(e.target.value)} dir="ltr" autoComplete="one-time-code" /></Field>
      <Button onClick={confirm} disabled={busy||!/^\d{6}$/.test(code)}>تأیید و فعال‌سازی</Button>
    </div>}
    {status==='enabled'&&remaining!==null&&!enroll&&!recoveryCodes.length&&!enrollmentRequired&&<div className="form-stack">
      <p className="muted">تعداد کدهای بازیابی باقی‌مانده: {remaining}</p>
      <Field label="رمز فعلی برای صدور مجدد کدهای بازیابی"><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Field label="کد دومرحله‌ای تازه"><input type="text" dir="ltr" maxLength={6} inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)} /></Field>
      <Button disabled={busy||!password||!/^[0-9]{6}$/.test(code)} onClick={rotateRecovery}>ابطال کدهای قدیمی و صدور کدهای جدید</Button>
      {!enrollmentRequired&&<Button disabled={busy||!password||!/^[0-9]{6}$/.test(code)} onClick={start}>ثبت عامل دوم جدید</Button>}
    </div>}
    {!!recoveryCodes.length&&<div className="form-stack">
      <Callout>این کدها فقط همین یک‌بار نمایش داده می‌شوند و هر کد فقط یک بار کار می‌کند. آن‌ها را در Password Manager ذخیره کن و داخل مستندات ProjectOS وارد نکن.</Callout>
      <pre dir="ltr" className="font-mono whitespace-pre-wrap break-all select-text">{recoveryCodes.join('\n')}</pre>
      <Button onClick={()=>setRecoveryCodes([])}>کدها را در محل امن ذخیره کردم؛ پنهان کن</Button>
    </div>}
    {enrollmentRequired&&status==='enabled'&&!recoveryCodes.length&&<Link href="/dashboard">ورود به فضای کاری</Link>}
    {message&&<p role="status" className="muted">{message}</p>}
  </div>;
}

function SessionsModal({onClose}:{onClose:()=>void}){
  const router=useRouter();
  const [sessions,setSessions]=useState<Array<{createdAt:number;expiresAt:number}>>([]);
  const [status,setStatus]=useState('');
  const [password,setPassword]=useState('');
  const [totp,setTotp]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let live=true;
    fetch('/api/auth/sessions',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(live)setSessions(data.sessions??[]);})
      .catch(()=>{if(live)setStatus('دریافت نشست‌ها ناموفق بود.');});
    return ()=>{live=false;};
  },[]);
  async function revoke(action:'revokeOthers'|'revokeAll'){
    setBusy(true);setStatus('');
    try{
      const res=await fetch('/api/auth/sessions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,password,totp})});
      const result=await res.json();if(!res.ok||!result.ok)throw Error('احراز مجدد یا ابطال نشست‌ها ناموفق بود.');
      setPassword('');setTotp('');
      if(action==='revokeAll'){
        // A full document reload clears any previously authenticated UI state.
        router.replace('/login');router.refresh();return;
      }
      setSessions(existing=>existing.slice(0,1));setStatus(`${result.revoked} نشست دیگر باطل شد.`);
    }catch(error){setStatus(error instanceof Error?error.message:'خطا در ابطال');}finally{setBusy(false);}
  }
  return <Modal title="مدیریت نشست‌های حساب" onClose={onClose}>
    <div className="form-stack">
      <Callout>زمان‌های ساخت و انقضای نشست‌ها نشان داده می‌شوند؛ نام و دستگاه مرورگر در این نسخه ثبت نمی‌شوند. ابطال نشست نیازمند رمز و در صورت فعال بودن، کد MFA تازه است.</Callout>
      <p>تعداد نشست‌های فعال: {sessions.length}</p>
      {sessions.map((session,index)=><Row key={`${session.createdAt}-${index}`} icon={UserRound} title={`نشست ${index+1}`} meta={`ایجاد: ${new Date(session.createdAt).toLocaleString('fa-IR')} · انقضا: ${new Date(session.expiresAt).toLocaleString('fa-IR')}`} />)}
      <Field label="رمز فعلی"><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Field label="کد دومرحله‌ای تازه (اگر فعال است)"><input type="text" dir="ltr" maxLength={6} inputMode="numeric" value={totp} onChange={e=>setTotp(e.target.value)}/></Field>
      <div className="flex gap-2 flex-wrap">
        <Button disabled={busy||!password} onClick={()=>revoke('revokeOthers')}>خروج از نشست‌های دیگر</Button>
        <Button disabled={busy||!password} onClick={()=>revoke('revokeAll')}>خروج از تمام نشست‌ها</Button>
      </div>
      {status&&<p role="status" className="muted">{status}</p>}
    </div>
  </Modal>;
}
