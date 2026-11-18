'use client';

import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { dateLabel, matches } from '@/lib/format';
import { useDemo } from '@/lib/store';
import { ProjectField, ProjectFilter, projectName } from './forms';
import { Button, Empty, Field, Filter, Heading, Panel, SearchField } from './ui';

export function ActivityLog() {
  const { data, projectScope, setProjectScope } = useDemo();
  const [saving,setSaving]=useState(false);
  const [query,setQuery] = useState('');
  const [source,setSource] = useState('');
  const [error,setError] = useState('');
  const sources = [...new Set(data.events.map(e => e.source))];
  const items = data.events.filter(e => (!projectScope || e.projectId === projectScope) && (!source || e.source === source) && matches(query,e.title,e.detail,e.actor));

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setSaving(true);
    const form=event.currentTarget;
    const fd=new FormData(form);
    const title=String(fd.get('title')||'').trim(),detail=String(fd.get('detail')||'').trim(),projectId=String(fd.get('project')||'');
    if(!title||!detail){setError('عنوان و شرح رویداد را وارد کنید.');setSaving(false);return;}
    try{
      const response=await fetch('/api/activity',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,detail,projectId})});
      if(!response.ok)throw new Error('رویداد ذخیره نشد.');
      form.reset();
      // The authoritative activity stream is built on the server, never forged by the client.
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:'خطا در ثبت رویداد');setSaving(false);}
  }

  return <>
    <Heading title="تاریخچه فعالیت‌ها" subtitle="ردیابی تغییرات فنی، تصمیم‌ها و اقدامات در پروژه‌ها"><a className="button button-primary" href="#new-event"><Plus size={16} aria-hidden="true" />ثبت رویداد جدید</a></Heading>
    <div className="split">
      <Panel title="تایم‌لاین فعالیت‌ها">
        <div className="toolbar"><SearchField label="جست‌وجوی فعالیت" value={query} onChange={setQuery} /><ProjectFilter value={projectScope} onChange={setProjectScope} />
          <Filter label="منبع رویداد" value={source} onChange={setSource} options={[{value:'',label:'همه منابع'},...sources.map(value => ({value,label:value}))]} />
        </div>
        {items.length ? <ol className="timeline">{items.map(e => <li key={e.id}>
          <strong>{e.title}</strong><p>{e.detail}</p><small><bdi>{projectName(data,e.projectId)}</bdi> · {e.actor} · {e.source} · <time dateTime={e.date}>{dateLabel(e.date,{day:'numeric',month:'long'},data.preferences.zone)}</time></small>
        </li>)}</ol> : <Empty title="رویدادی با این فیلتر پیدا نشد" />}
      </Panel>
      <Panel title="ثبت سریع یک اتفاق">
        <form id="new-event" className="form-stack" onSubmit={submit}>
          <ProjectField initial={projectScope} key={projectScope} />
          <Field label="عنوان رویداد"><input required name="title" maxLength={85} placeholder="مثلاً مرور چک‌لیست انتشار" /></Field>
          <Field label="چه اتفاقی افتاد؟"><textarea name="detail" rows={5} maxLength={500} required placeholder="توضیح کوتاهی از تغییر یا تصمیم ثبت کنید…" /></Field>
<p className="muted">ثبت رویداد و ایجاد وظیفه، عملیات جداگانه هستند. رویدادها با شناسه حساب واقعی ثبت می‌شوند.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div><Button variant="primary" type="submit" disabled={saving}>{saving?'در حال ثبت…':'ثبت رویداد'}</Button></div>
        </form>
      </Panel>
    </div>
  </>;
}
