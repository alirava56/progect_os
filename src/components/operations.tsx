'use client';

import { useEffect, useState } from 'react';
import { Activity, Bell, Check, CircleAlert, Clock3, Radio } from 'lucide-react';
import { afterHours, dateLabel, matches, serverHref } from '@/lib/format';
import { choices, incidentStates, priorities, priorityTones } from '@/lib/labels';
import { savePreferences, useDemo } from '@/lib/store';
import type { Incident } from '@/lib/types';
import { ProjectFilter, projectName } from './forms';
import { Button, Callout, Empty, Filter, Heading, Metrics, Modal, Panel, Pill, Row, SearchField, Switch, TextLink } from './ui';

export function Monitoring() {
  const { data }=useDemo();
  const [query,setQuery]=useState('');
  const [observations,setObservations]=useState<Array<{resourceId:string;checkedAt:string;state:string;statusCode:number|null;latencyMs:number|null;tlsExpiresAt:string|null}>>([]);
  const [machine,setMachine]=useState<Array<{resourceId:string;checkedAt:string;cpuPercent:number;usedBytes:number;totalBytes:number;state:string}>>([]);
  const [monitorStatus,setMonitorStatus]=useState<'loading'|'not_configured'|'configured'|'error'>('loading');
  useEffect(()=>{
    let cancelled=false;
    fetch('/api/monitoring',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error('Unavailable');
      return response.json();
    }).then(payload=>{
      if(cancelled)return;
      setObservations(Array.isArray(payload.observations)?payload.observations:[]);
      setMachine(Array.isArray(payload.machineObservations)?payload.machineObservations:[]);
      setMonitorStatus(payload.status==='configured'?'configured':'not_configured');
    }).catch(()=>{if(!cancelled)setMonitorStatus('error');});
    return ()=>{cancelled=true;};
  },[]);
  const latest=new Map<string,(typeof observations)[number]>();
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),30_000);
    return ()=>clearInterval(timer);
  },[]);
  for(const obs of observations){if(!latest.has(obs.resourceId))latest.set(obs.resourceId,obs);}
  const fresh=(id:string)=>{
    const observation=latest.get(id);
    return observation&&Number.isFinite(Date.parse(observation.checkedAt))&&clock-Date.parse(observation.checkedAt)>=-60_000&&clock-Date.parse(observation.checkedAt)<=15*60*1000&&observation.state!=='stale'?observation:undefined;
  };
  const unknown=data.resources.filter(r=>!fresh(r.id)).length;
  const resources=data.resources.filter(r=>matches(query,r.name,r.address,r.provider));
  const expiring=data.resources.filter(r=>r.expires&&Date.parse(r.expires)>=clock&&Date.parse(r.expires)<clock+7*24*60*60*1000);
  return <>
    <Heading title="وضعیت سرویس‌ها" subtitle="مشاهدات زمان‌دار HTTPS فقط برای دامنه‌های مجاز و فعال‌شده در تنظیمات سرور ثبت می‌شوند." />
    <div className="stack">
      <Callout><strong>وضعیت اتصال: {monitorStatus==='configured'?'Worker پیکربندی شده':monitorStatus==='loading'?'در حال دریافت':monitorStatus==='error'?'خطای دریافت':'غیرفعال'}.</strong> سلامت فقط برای مشاهدات معتبر ۱۵ دقیقه اخیر گزارش می‌شود. پایش نیازمند اجرای زمان‌بندی‌شده Worker است؛ بررسی دائمی خودکار هنوز فعال نیست.</Callout>
      <Metrics entries={[
        {label:'منابع ثبت‌شده',value:data.resources.length,note:'اطلاعات دستی، نه پایش زنده',icon:Radio},
        {label:'وضعیت نامشخص',value:unknown,note:'بدون مشاهده تازه',icon:Clock3},
        {label:'تمدید در ۷ روز',value:expiring.length,note:'براساس تاریخ ثبت‌شده',icon:Bell},
        {label:'هشدار ثبت‌شده',value:data.incidents.filter(i=>i.state==='open').length,note:'باز و نیازمند بررسی',icon:CircleAlert},
      ]}/>
      <Panel title="دارایی‌ها و آخرین وضعیت ثبت‌شده"><SearchField label="جست‌وجوی منبع" value={query} onChange={setQuery}/>
        {resources.length?resources.map(item=><Row key={item.id} icon={Activity} title={item.name} meta={<bdi dir="ltr">{item.address}</bdi>}
          href={item.type==='server'?serverHref(item.id):'/infrastructure'} end={fresh(item.id)?
            <Pill tone={fresh(item.id)?.state==='healthy'?'good':'warn'}>{fresh(item.id)?.state==='healthy'?'HTTPS پاسخ‌گو':fresh(item.id)?.state==='unhealthy'?'HTTPS ناموفق':'وضعیت نامشخص'} · {dateLabel(fresh(item.id)!.checkedAt,{hour:'2-digit',minute:'2-digit'})}</Pill>:
            <Pill tone="warn">نامشخص · بدون بررسی تازه</Pill>}/>
):<Empty title="هنوز منبعی ثبت نشده است"/>}
      </Panel>
      <Panel title="آخرین مشاهدات HTTPS">{observations.length?
        <div className="stack">{observations.slice(0,12).map((o,index)=><Row key={`${o.resourceId}-${o.checkedAt}-${index}`} icon={Activity}
          title={data.resources.find(r=>r.id===o.resourceId)?.name??'منبع'}
          meta={<>{dateLabel(o.checkedAt,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · کد {o.statusCode??'نامشخص'} · {o.latencyMs??'—'} ms
            {o.tlsExpiresAt?' · انقضای TLS '+dateLabel(o.tlsExpiresAt):''}</>}
          end={<Pill tone={o.state==='healthy'?'good':'warn'}>{o.state==='healthy'?'HTTPS پاسخ‌گو':o.state==='unhealthy'?'HTTPS ناموفق':'وضعیت نامشخص'}</Pill>}/>)}</div>:
        <Empty title="هنوز مشاهده‌ای ثبت نشده" detail="در صورت فعال‌سازی میزبان‌های مجاز و اجرای Worker، نتایج HTTPS در اینجا نمایش داده می‌شوند."/>}</Panel>
      <Panel title="آخرین گزارش‌های عامل میزبان">
        {machine.length?machine.slice(0,10).map(o=><Row key={o.resourceId+o.checkedAt} icon={Activity}
          title={data.resources.find(r=>r.id===o.resourceId)?.name??'منبع'}
          meta={dateLabel(o.checkedAt,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · عامل میزبان'}
          end={o.state==='observed'&&clock-Date.parse(o.checkedAt)<=900_000
            ? <Pill>CPU {Math.round(o.cpuPercent)}٪ · RAM {Math.round(o.usedBytes/o.totalBytes*100)}٪</Pill>
            : <Pill tone="warn">گزارش قدیمی</Pill>}/>) : <Empty title="گزارشی از عامل میزبان دریافت نشده" />}
      </Panel>
    </div>
  </>;
}

const rules = [
  { key:'renewal',title:'یادآوری تمدید سرور',detail:'پیش از سررسید زیرساخت'},
  { key:'outage',title:'هشدار قطعی سرویس',detail:'ترجیح نمایشی برای پایش آینده'},
  { key:'stale',title:'وظایف بدون فعالیت',detail:'پس از ۷ روز'},
  { key:'digest',title:'خلاصه روزانه',detail:'ترجیح نمایشی فضای کاری'},
] as const;

export function Alerts() {
  const { data, projectScope, setProjectScope, change } = useDemo();
  const [filter,setFilter] = useState('open');
  const [priority,setPriority] = useState('');
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState<string>();
  const [config,setConfig] = useState(false);
  const scoped = data.incidents.filter(a => !projectScope || a.projectId === projectScope);
  const open = scoped.filter(a => a.state === 'open');
  const items = scoped.filter(a => (!filter || a.state === filter) && (!priority || a.priority === priority) && matches(query,a.title,a.source));
  const alert = data.incidents.find(a => a.id === selected);

  function updateState(next: Incident['state']) {
    if (!alert) return;
    const snoozedUntil = next === 'snoozed' ? afterHours(24) : undefined;
    const action = next === 'snoozed' ? 'هشدار ۲۴ ساعت به تعویق افتاد.' : next === 'acknowledged' ? 'رسیدگی به هشدار ثبت شد.' : 'هشدار دوباره باز شد.';
    change(previous => ({...previous,incidents:previous.incidents.map(a => a.id === alert.id ? {...a,state:next,snoozedUntil} : a)}),
      action,{projectId:alert.projectId,title:action,source:'هشدارها',detail:alert.title});
    setSelected(undefined);
  }

  function settings() {
    return rules.map(rule => <div className="setting-row" key={rule.key}><div><strong>{rule.title}</strong><small>{rule.detail}</small></div>
      <Switch label={rule.title} checked={data.preferences[rule.key]} onChange={checked => {
        const preferences = {...data.preferences,[rule.key]:checked};
        const saved = savePreferences(preferences);
        change(d => ({...d,preferences}),saved ? 'ترجیح ثبت شد.' : 'ترجیح ثبت شد.');
      }} /></div>);
  }

  return <>
    <Heading title="هشدارها و یادآوری‌ها" subtitle="موارد نیازمند اقدام، سررسیدها و اطلاعات ناقص پروژه">
      <Button variant="primary" icon={Bell} onClick={() => setConfig(true)}>تنظیم یادآوری‌ها</Button>
    </Heading>
    <div className="stack">
      <Metrics entries={[
        {label:'هشدارهای باز',value:open.length,note:'اطلاعات ثبت‌شده',icon:Bell},
        {label:'اولویت بالا',value:open.filter(a => a.priority === 'high').length,note:'نیازمند توجه',icon:CircleAlert},
        {label:'به‌تعویق‌افتاده',value:scoped.filter(a => a.state === 'snoozed').length,note:'تا زمان بازبینی',icon:Clock3},
        {label:'رسیدگی‌شده',value:scoped.filter(a => a.state === 'acknowledged').length,note:'در محدودهٔ انتخاب‌شده',icon:Check,tone:'good'},
      ]} />
      <div className="split">
        <Panel title="موارد نیازمند اقدام">
          <div className="toolbar"><SearchField label="جست‌وجوی هشدار" value={query} onChange={setQuery} /><ProjectFilter value={projectScope} onChange={setProjectScope} />
            <Filter label="وضعیت هشدار" value={filter} onChange={setFilter} options={[{value:'',label:'همه وضعیت‌ها'},...choices(incidentStates)]} />
            <Filter label="اولویت هشدار" value={priority} onChange={setPriority} options={[{value:'',label:'همه اولویت‌ها'},...choices(priorities)]} />
          </div>
          {items.length ? items.map(a => <Row key={a.id} icon={Bell} title={a.title} meta={<>{projectName(data,a.projectId)} · {a.source} · {dateLabel(a.date)}</>}
            end={<Pill tone={priorityTones[a.priority]}>{priorities[a.priority]}</Pill>} onClick={() => setSelected(a.id)} />) : <Empty title="هشداری با این فیلترها پیدا نشد" />}
        </Panel>
        <Panel title="تنظیمات یادآوری">{settings()}<p className="muted mt-3">تنظیمات ذخیره می‌شوند؛ ارسال تلگرام فقط با پیکربندی و اجرای Worker مستقل انجام می‌شود. ایمیل هنوز پیاده‌سازی نشده است.</p></Panel>
      </div>
    </div>
    {alert && <Modal title="بررسی هشدار" onClose={() => setSelected(undefined)}><div className="form-stack">
      <Row icon={Bell} title={alert.title} meta={<>{projectName(data,alert.projectId)} · {alert.source}</>} end={<Pill tone={priorityTones[alert.priority]}>{priorities[alert.priority]}</Pill>} />
      <p className="muted">وضعیت: {incidentStates[alert.state]}{alert.snoozedUntil && ` · تا ${dateLabel(alert.snoozedUntil,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'},data.preferences.zone)}`}</p>
      <div className="form-actions">{alert.state !== 'acknowledged' && <Button variant="primary" icon={Check} onClick={() => updateState('acknowledged')}>ثبت رسیدگی</Button>}
        {alert.state === 'open' ? <Button icon={Clock3} onClick={() => updateState('snoozed')}>تعویق ۲۴ ساعته</Button> : <Button onClick={() => updateState('open')}>بازگشایی هشدار</Button>}
      </div>
    </div></Modal>}
    {config && <Modal title="تنظیم یادآوری‌ها" onClose={() => setConfig(false)}><Callout>ترجیحات در فضای کاری ذخیره می‌شوند. ارسال تلگرام نیازمند تنظیم اعتبارنامه و Worker مستقل است؛ ایمیل هنوز پیاده‌سازی نشده است.</Callout>{settings()}
      <div className="modal-footer"><TextLink href="/calendar">ثبت یادآوری در تقویم</TextLink></div>
    </Modal>}
  </>;
}


