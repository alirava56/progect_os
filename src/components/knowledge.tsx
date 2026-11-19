'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpLeft, FileText, FolderOpen, Pencil, Plus, Send } from 'lucide-react';
import { dateLabel, docHref, matches, newId, now, number } from '@/lib/format';
import { useDemo } from '@/lib/store';
import type { Doc, DocType } from '@/lib/types';
import { ProjectField, ProjectFilter, SelectOptions, projectName } from './forms';
import { Art, Button, Callout, Empty, Field, FormActions, Heading, IconButton, Modal, Panel, Pill, SearchField, formValues } from './ui';

const docTypes: DocType[] = ['Runbook','Technical Design','Decision Record','Checklist','Release Notes'];

function DocForm({ onClose, doc, projectId, onSaved }: { onClose: () => void; doc?: Doc; projectId: string; onSaved: (id: string) => void }) {
  const { change, saving } = useDemo();
  const [error,setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    const get = formValues(event);
    if (!get('title') || !get('body')) { setError('عنوان و متن سند را وارد کنید.'); return; }
    const item: Doc = { id:doc?.id ?? newId('doc'), title:get('title'), projectId:get('project'), type:get('type') as DocType,
      body:get('body'), revision:(doc?.revision ?? 0) + 1, updated:now() };
    const saved = await change(data => ({...data,docs:doc ? data.docs.map(d => d.id === item.id ? item : d) : [item,...data.docs]}),
      'مستند ذخیره شد.',{ projectId:item.projectId,title:doc ? 'سند به‌روزرسانی شد' : 'سند جدید ثبت شد',detail:item.title,source:'مستندات' });
    if (!saved) { setError('ذخیرهٔ سند تأیید نشد.'); return; }
    onSaved(item.id);
    onClose();
  }
  return <Modal title={doc ? 'ویرایش سند' : 'سند جدید'} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <Field label="عنوان سند"><input autoFocus required name="title" maxLength={90} defaultValue={doc?.title} /></Field>
      <div className="form-grid"><ProjectField initial={doc?.projectId ?? projectId} /><Field label="نوع سند"><select name="type" defaultValue={doc?.type}><SelectOptions options={docTypes} /></select></Field></div>
      <Field label="متن سند (بدون رمز و توکن)"><textarea required name="body" rows={8} maxLength={6000} defaultValue={doc?.body} /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onClose} saving={saving} submit="ذخیره سند" />
    </form>
  </Modal>;
}

export function Docs() {
  const { data, projectScope, setProjectScope } = useDemo();
  const params = useSearchParams();
  const router = useRouter();
  const [query,setQuery] = useState('');
  const [editing,setEditing] = useState<'edit' | 'new' | null>(null);
  const [collapsed,setCollapsed] = useState<string[]>([]);
  const [history,setHistory] = useState<Doc[]|null>(null);
  const [historyError,setHistoryError]=useState('');
  const [historyOpen,setHistoryOpen]=useState(false);
  const items = data.docs.filter(d => (!projectScope || d.projectId === projectScope) && matches(query,d.title,d.body,d.type));
  const explicit = data.docs.find(d => d.id === params.get('doc'));
  const selected = explicit ?? items[0];
  function clearSelection() {
    if (params.has('doc')) router.replace('/docs',{scroll:false});
  }
  return <>
    <Heading title="مستندات و دانش پروژه‌ها" subtitle="راهنماهای فنی، تصمیم‌ها و چک‌لیست‌های پروژه">
      <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>سند جدید</Button>
    </Heading>
    <div className="split docs-layout">
      <Panel title="کتابخانه مستندات" action={<ProjectFilter value={projectScope} onChange={value => {setProjectScope(value);clearSelection();}} />}>
        <SearchField label="جست‌وجو در مستندات، تصمیم‌ها و دستورها" value={query} onChange={value => {setQuery(value);clearSelection();}} />
        <div className="document-tree">{data.projects.map(p => {
          const docs = items.filter(d => d.projectId === p.id);
          if (!docs.length) return null;
          const open = !!query || !collapsed.includes(p.id);
          return <section key={p.id}>
            <button type="button" className="doc-folder" aria-expanded={open} onClick={() => setCollapsed(old => open ? [...old,p.id] : old.filter(id => id !== p.id))} disabled={!!query}><FolderOpen size={16} aria-hidden="true" /><bdi>{p.name}</bdi><small>{number(docs.length)} سند</small></button>
            {open && docs.map(d => <Link key={d.id} href={docHref(d.id)} scroll={false} className={`item-row item-interactive doc-link ${selected?.id === d.id ? 'selected' : ''}`} aria-current={selected?.id === d.id ? 'true' : undefined}>
              <FileText size={15} aria-hidden="true" /><span className="row-copy"><strong>{d.title}</strong></span><Pill><bdi>{d.type}</bdi></Pill>
            </Link>)}
          </section>;
        })}</div>
        {!items.length && <Empty title="سندی با این جست‌وجو پیدا نشد" />}
      </Panel>
      <Panel title="پیش‌نمایش سند" action={selected && <div className="flex items-center gap-2"><Button onClick={async()=>{
        setHistoryOpen(true);setHistory(null);setHistoryError('');
        try{const response=await fetch(`/api/docs/history?id=${encodeURIComponent(selected.id)}`,{cache:'no-store'});if(!response.ok)throw Error('تاریخچه قابل دریافت نیست');const payload=await response.json();setHistory(payload.versions);}catch(e){setHistoryError(e instanceof Error?e.message:'خطا');}
      }}>تاریخچه نسخه‌ها</Button><IconButton label="ویرایش سند" icon={Pencil} onClick={() => setEditing('edit')} /></div>}>
        {selected ? <article className="document-preview">
          <div className="flex items-center justify-between gap-2"><Art name="navigation/documents" size={48} /><Pill><bdi>{selected.type}</bdi></Pill></div>
          <p className="muted"><bdi>{projectName(data,selected.projectId)}</bdi></p>
          <h3>{selected.title}</h3><p className="document-body" dir="auto">{selected.body}</p>
          <div className="doc-revision">نسخهٔ ثبت‌شده {number(selected.revision)} · {dateLabel(selected.updated)}</div>
        </article> : <Empty title="سندی برای پیش‌نمایش انتخاب نشده است" />}
      </Panel>
    </div>
    {historyOpen && <Modal title="تاریخچه نسخه‌های ثبت‌شده" onClose={()=>setHistoryOpen(false)}>
      {historyError&&<Callout>{historyError}</Callout>}
      {history===null&&!historyError&&<p className="muted">در حال بارگذاری…</p>}
      {history?.length===0&&<Empty title="نسخه قبلی ثبت نشده است"/>}
      {history?.map(d=><section key={d.revision} className="stack" style={{marginBottom:16}}><Pill>نسخه {number(d.revision)}</Pill><strong>{d.title}</strong><p className="document-body" dir="auto">{d.body}</p></section>)}
    </Modal>}
    {editing && <DocForm doc={editing === 'edit' ? selected : undefined} projectId={projectScope} onClose={() => setEditing(null)} onSaved={id => router.push(docHref(id),{scroll:false})} />}
  </>;
}

type SourceCitation = {id:string;title:string;kind:string;href:string;updatedAt:string|null;excerpt?:string};
type SearchExchange = {id:string;query:string;answer:string;citations:SourceCitation[];mode:'retrieval'|'llm';externalTransmission:boolean|null;caution?:string};
const starterPrompts=['وظایف باز','مستندات پروژه','سرور و دامنه','تمدید'];
export function Assistant(){
  const {data,projectScope,setProjectScope}=useDemo();
  const [allowExternal,setAllowExternal]=useState(false);
  const [query,setQuery]=useState('');
  const [exchanges,setExchanges]=useState<SearchExchange[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function send(text:string){
    const value=text.trim();if(!value||busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({question:value,projectId:projectScope||undefined,allowExternal})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'جست‌وجو ناموفق بود');
      setExchanges(previous=>[{id:newId('search'),query:value,answer:result.answer,citations:result.citations||[],
        mode:result.mode,externalTransmission:result.externalTransmission??null,caution:result.caution},...previous]);
      setQuery('');setAllowExternal(false);
    }catch(e){setError(e instanceof Error?e.message:'خطای جست‌وجو');}
    finally{setBusy(false);}
  }
  return <>
    <Heading title="حافظه و جست‌وجوی دانش پروژه‌ها" subtitle="جست‌وجوی مجاز در داده‌های واقعی، پاسخ آزمایشی AI فقط با فعال‌سازی آگاهانه روی سرور">
      <Button variant="primary" icon={Plus} onClick={()=>{setExchanges([]);setQuery('');}}>گفتگوی جدید</Button>
    </Heading>
    <div className="split">
      <Panel className="chat-panel" title={<span className="flex items-center gap-2"><Art name="navigation/ai-assistant" size={42}/><bdi>ProjectOS Knowledge</bdi></span>} action={<Pill tone="warn">AI اختیاری</Pill>}>
        <div className="chat-history" aria-live="polite">
          {exchanges.length?exchanges.map(msg=><div key={msg.id} className="chat-exchange">
            <div className="chat-user" dir="auto">{msg.query}</div>
            <div className="chat-answer">
              <strong>{msg.mode==='llm'?'پاسخ آزمایشی مدل':'نتایج جست‌وجوی مستند'}</strong>
              <p dir="auto" className="document-body">{msg.answer}</p>
              {msg.citations.length?<div className="stack">{msg.citations.map(hit=><Link key={`${hit.kind}:${hit.id}`} href={hit.href} className="item-row item-interactive">
                <FileText size={15} aria-hidden="true"/><span className="row-copy"><strong>{hit.title}</strong><small>{hit.kind} · {hit.updatedAt?dateLabel(hit.updatedAt):'تاریخ نامشخص'} · {hit.excerpt?.slice(0,100)||''}</small></span><ArrowUpLeft size={14}/>
              </Link>)}</div>:<p>هیچ منبعی یافت نشد.</p>}
              <p className="muted">{msg.externalTransmission===true?'برای پاسخ، انتقال داده به سرویس AI تلاش شده است.':msg.externalTransmission===false?'در این درخواست تلاشی برای ارسال خارجی انجام نشد.':'وضعیت دریافت داده توسط سرویس خارجی نامشخص است؛ ممکن است ارسال شده باشد.'} {msg.caution||''}</p>
            </div>
          </div>):<Empty title="پرسش خود را وارد کنید" detail="پاسخ فقط از منابع قابل دسترس Workspace استخراج می‌شود. اطلاعات محرمانه را وارد نکنید."/>}
          {busy&&<p className="muted" role="status">در حال بررسی منابع…</p>}
          {error&&<p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="toolbar">
          <Field label="پروژهٔ جست‌وجو"><select value={projectScope} onChange={event=>{setProjectScope(event.currentTarget.value);setAllowExternal(false);}}>
            <option value="">همهٔ پروژه‌های مجاز</option>
            {data.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}
          </select></Field>
          {data.users[0]?.role==='Owner'&&projectScope&&<label><input type="checkbox" checked={allowExternal}
            onChange={event=>setAllowExternal(event.currentTarget.checked)} /> اجازهٔ ارسال پرسش و گزیدهٔ منابع این پروژه برای همین پاسخ</label>}
        </div>
        <form className="chat-form" onSubmit={event=>{event.preventDefault();void send(query);}}>
          <input aria-label="جست‌وجو در دانش" dir="auto" placeholder="مثلاً: تصمیم‌های اخیر، سررسیدها یا وضعیت پروژه…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={400}/>
          <IconButton label="جست‌وجو" type="submit" icon={Send} disabled={!query.trim()||busy}/>
        </form>
      </Panel>
      <Panel title="پرسش‌های پیشنهادی" className="stack">
        <div className="suggested-prompts">{starterPrompts.map(q=><Button key={q} disabled={busy} onClick={()=>void send(q)}>{q}<ArrowUpLeft size={14}/></Button>)}</div>
        <Callout>حالت پیش‌فرض جست‌وجوی داخلی است. برای فعال‌سازی تولید پاسخ به یک سرویس AI، ادمین باید به‌صورت صریح اجازه دهد. داده‌های متن مستندات بدون تنظیم دوم جداگانه به سرویس بیرونی ارسال نمی‌شوند. پاسخ مدل باید با منابع بررسی شود.</Callout>
      </Panel>
    </div>
  </>;
}
