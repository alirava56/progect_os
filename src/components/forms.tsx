'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/lib/store';
import type { DemoData, Environment, Project, ProjectStatus, Resource, ResourceType, ResourceStatus, Task, TaskStatus, Priority, Reminder } from '@/lib/types';
import { choices, priorities, projectStatuses, resourceStatuses, resourceTypes, taskStatuses } from '@/lib/labels';
import { newId, projectHref, serverHref, taskHref, today } from '@/lib/format';
import { Callout, Field, Filter, FormActions, Modal, formValues, type Choice } from './ui';

const environments = ['Production', 'Staging', 'Development'];
const projectTypes = ['وب‌سایت', 'محصول نرم‌افزاری', 'زیرساخت', 'سایر'];
const resourceTags: Record<ResourceType, string> = { server:'VPS',domain:'DNS',database:'SQL',service:'HTTPS' };

export function ProjectFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useDemo();
  return <Filter label="فیلتر پروژه" value={value} onChange={onChange} options={[{ value:'',label:'همه پروژه‌ها' }, ...data.projects.map(p => ({ value:p.id,label:p.name }))]} />;
}

export function SelectOptions({ options }: { options: ReadonlyArray<string | Choice> }) {
  return <>{options.map(option => {
    const { value, label } = typeof option === 'string' ? { value:option, label:option } : option;
    return <option key={value} value={value}>{label}</option>;
  })}</>;
}
export function ProjectField({ initial, all = false }: { initial?: string; all?: boolean }) {
  const { data } = useDemo();
  return <Field label="پروژه"><select name="project" defaultValue={initial ?? ''} required={!all}>
    <option value="">{all ? 'همه پروژه‌ها' : 'انتخاب پروژه'}</option>
    <SelectOptions options={data.projects.filter(p => p.status !== 'archived' || p.id === initial).map(p => ({ value:p.id, label:p.name }))} />
  </select></Field>;
}

export function ProjectForm({ onClose, project }: { onClose: () => void; project?: Project }) {
  const { change } = useDemo();
  const router = useRouter();
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    const get = formValues(event);
    const name = get('name');
    if (!name) { setError('نام پروژه را وارد کنید.'); return; }
    const type = get('type');
    const updated: Project = {
      ...project, id:project?.id ?? newId('project'), name, coverTitle:project && project.coverTitle !== project.name ? project.coverTitle : name,
      subtitle:get('subtitle') || type, description:get('description'), type,
      status:get('status') as ProjectStatus, progress:Number(get('progress')),
      next:get('next') || 'تعریف گام بعدی', art:project?.art ?? 'navigation/projects',
    };
    const message = project ? 'پروژه به‌روزرسانی شد.' : 'پروژه ایجاد شد.';
    change(data => ({ ...data, projects:project ? data.projects.map(p => p.id === project.id ? updated : p) : [...data.projects, updated] }),
      message, { projectId:updated.id,title:message,source:'پروژه‌ها' });
    onClose();
    if (!project) router.push(projectHref(updated.id));
  }
  return <Modal title={project ? 'ویرایش پروژه' : 'پروژه جدید'} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <Field label="نام پروژه"><input autoFocus required name="name" defaultValue={project?.name} maxLength={75} dir="auto" /></Field>
      <div className="form-grid">
        <Field label="نوع پروژه"><select name="type" defaultValue={project?.type}><SelectOptions options={projectTypes} /></select></Field>
        <Field label="وضعیت"><select name="status" defaultValue={project?.status}><SelectOptions options={choices(projectStatuses)} /></select></Field>
        <Field label="پیشرفت (درصد)"><input name="progress" type="number" min="0" max="100" defaultValue={project?.progress ?? 0} dir="ltr" required /></Field>
        <Field label="اقدام بعدی"><input name="next" maxLength={90} defaultValue={project?.next} /></Field>
      </div>
      <Field label="عنوان کوتاه"><input name="subtitle" maxLength={100} defaultValue={project?.subtitle} /></Field>
      <Field label="توضیحات"><textarea name="description" rows={3} maxLength={600} defaultValue={project?.description} /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onClose} submit={project ? 'ذخیره تغییرات' : 'ایجاد پروژه'} />
    </form>
  </Modal>;
}

export function TaskForm({ onClose, task, projectId, status }: { onClose: () => void; task?: Task; projectId?: string; status?: TaskStatus }) {
  const { data, change } = useDemo();
  const router = useRouter();
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    const get = formValues(event);
    if (!get('title')) { setError('عنوان وظیفه را وارد کنید.'); return; }
    const dependencyIds=new FormData(event.currentTarget).getAll('dependencies').map(String);
    const item: Task = {
      id:task?.id ?? newId('task'), title:get('title'), projectId:get('project'), status:get('status') as TaskStatus,
      priority:get('priority') as Priority, owner:get('owner'), due:get('due'), description:get('description'),
      checklist:task?.checklist ?? [], comments:task?.comments ?? [], dependencies:dependencyIds,
    };
    const message = task ? 'تغییرات وظیفه ذخیره شد.' : 'وظیفه ایجاد شد.';
    change(previous => ({ ...previous,tasks:task ? previous.tasks.map(t => t.id === item.id ? { ...item, checklist:t.checklist,comments:t.comments } : t) : [item, ...previous.tasks] }),
      message, { projectId:item.projectId,title:message,detail:item.title,source:'وظایف' });
    onClose();
    if (!task) router.push(taskHref(item.id));
  }
  return <Modal title={task ? 'ویرایش وظیفه' : 'وظیفه جدید'} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <Field label="عنوان وظیفه"><input autoFocus name="title" required maxLength={100} defaultValue={task?.title} /></Field>
      <div className="form-grid">
        <ProjectField initial={task?.projectId ?? projectId} />
        <Field label="مسئول"><select name="owner" defaultValue={task?.owner ?? 'dev'}><SelectOptions options={data.users.filter(user => user.state === 'active').map(user => ({ value:user.id,label:user.name }))} /></select></Field>
        <Field label="وضعیت"><select name="status" defaultValue={task?.status ?? status}><SelectOptions options={choices(taskStatuses)} /></select></Field>
        <Field label="اولویت"><select name="priority" defaultValue={task?.priority ?? 'medium'}><SelectOptions options={choices(priorities)} /></select></Field>
      </div>
      <Field label="موعد (میلادی)"><input name="due" type="date" dir="ltr" required defaultValue={task?.due ?? today()} /></Field>
      <Field label="شرح وظیفه"><textarea name="description" rows={3} maxLength={1000} defaultValue={task?.description} /></Field>
      <Field label="وابستگی‌ها"><select name="dependencies" multiple size={Math.min(5,Math.max(2,data.tasks.length))} defaultValue={task?.dependencies??[]}>
        {data.tasks.filter(t=>t.id!==task?.id).map(t=><option key={t.id} value={t.id}>{t.title} · {data.projects.find(p=>p.id===t.projectId)?.name}</option>)}
      </select></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onClose} submit={task ? 'ذخیره تغییرات' : 'ایجاد وظیفه'} />
    </form>
  </Modal>;
}

function validInventoryAddress(value: string) {
  const address=value.trim();
  if(!address || address.length>350 || /[\s<>"'\\]/.test(address))return false;
  if(/^https?:\/\//i.test(address)) {
    try { const url=new URL(address);return !url.username&&!url.password&&['http:','https:'].includes(url.protocol); }catch{return false;}
  }
  if(address.includes('://')||address.includes('@'))return false;
  // IPv4, bracketed IPv6, DNS hostname or a neutral identifier. Metadata only: no probe is issued.
  return /^[a-z0-9][a-z0-9.:[\]-]{0,349}$/i.test(address);
}

export function ResourceForm({ onClose, resource, projectId, initialType = 'server' }: { onClose: () => void; resource?: Resource; projectId?: string; initialType?: ResourceType }) {
  const { change, data } = useDemo();
  const router = useRouter();
  const [type, setType] = useState<ResourceType>(resource?.type ?? initialType);
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    const get = formValues(event);
    if (!get('name') || !get('provider')) { setError('نام منبع و ارائه‌دهنده را وارد کنید.'); return; }
    if (!validInventoryAddress(get('address'))) { setError('یک IPv4، IPv6، دامنه یا URL معتبر بدون نام کاربری و رمز وارد کنید.'); return; }
    const sharedProjects = [...new FormData(event.currentTarget).getAll('sharedProjects')].map(String).filter(id=>id!==get('project'));
    const item: Resource = { ...resource, id:resource?.id ?? newId('resource'), name:get('name'), projectId:get('project'), linkedProjectIds:sharedProjects, type,
      address:get('address'), environment:get('environment') as Environment,status:get('status') as ResourceStatus,
      provider:get('provider'), region:get('region') || undefined, os:get('os') || undefined, port:type === 'server' ? Number(get('port')) : undefined,
      expires:get('expires') || undefined, tags:get('tags').split(/[,،]/).map(tag => tag.trim()).filter(Boolean).slice(0,6),
    };
    const message = resource ? 'مشخصات منبع به‌روزرسانی شد.' : 'منبع ثبت شد.';
    change(data => ({ ...data,resources:resource ? data.resources.map(r => r.id === item.id ? item : r) : [...data.resources,item] }),
      message,{ projectId:item.projectId,title:message,detail:item.name,source:'زیرساخت' });
    onClose();
    if (!resource && type === 'server') router.push(serverHref(item.id));
  }
  return <Modal title={resource ? 'ویرایش منبع' : 'افزودن منبع'} onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <Callout>مشخصات واقعی منبع را ثبت کنید، اما رمز، توکن و SSH Key را اینجا وارد نکنید. ثبت آدرس به معنی بررسی آنلاین بودن نیست.</Callout>
      <Field label="نام منبع"><input autoFocus name="name" maxLength={80} required defaultValue={resource?.name} dir="auto" /></Field>
      <div className="form-grid">
        <ProjectField initial={resource?.projectId ?? projectId} />
        <Field label="نوع منبع"><select value={type} disabled={!!resource} onChange={e => setType(e.target.value as ResourceType)}><SelectOptions options={choices(resourceTypes)} /></select></Field>
        <Field label="آدرس"><input dir="ltr" name="address" required placeholder="203.0.113.24" defaultValue={resource?.address} maxLength={350} /></Field>
        <Field label="محیط"><select name="environment" defaultValue={resource?.environment}><SelectOptions options={environments} /></select></Field>
        <Field label="ارائه‌دهنده"><input name="provider" required maxLength={70} defaultValue={resource?.provider ?? 'Example Cloud'} dir="auto" /></Field>
        <Field label="وضعیت"><select name="status" defaultValue={resource?.status}><SelectOptions options={choices(resourceStatuses)} /></select></Field>
        {type === 'server' && <>
          <Field label="پورت SSH"><input dir="ltr" name="port" type="number" min="1" max="65535" defaultValue={resource?.port ?? 22} required /></Field>
          <Field label="سیستم‌عامل"><input dir="auto" name="os" maxLength={60} defaultValue={resource?.os} /></Field>
          <Field label="موقعیت"><input dir="auto" name="region" maxLength={60} defaultValue={resource?.region} /></Field>
        </>}
        <Field label="سررسید (میلادی)"><input dir="ltr" name="expires" type="date" defaultValue={resource?.expires} /></Field>
      </div>
      {data.projects.length>1 && <Field label="پروژه‌های مرتبط دیگر (برای منابع مشترک)"><div><select name="sharedProjects" multiple size={Math.min(4,data.projects.length)} defaultValue={resource?.linkedProjectIds??[]}>
        {data.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
      </select><small className="muted">برای انتخاب چند پروژه Ctrl را نگه دارید. مالک اصلی از فیلد پروژه تعیین می‌شود.</small></div></Field>}
      <Field label="برچسب‌ها (جداشده با ویرگول)"><input dir="auto" name="tags" maxLength={100} key={type} defaultValue={resource?.tags.join('، ') ?? resourceTags[type]} /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions onClose={onClose} submit="ثبت مشخصات" />
    </form>
  </Modal>;
}

export function ReminderForm({ onClose, due, projectId }: { onClose: () => void; due?: string; projectId?: string }) {
  const { change } = useDemo();
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    const get = formValues(event);
    if (!get('title')) { setError('عنوان رویداد را وارد کنید.'); return; }
    const item: Reminder = { id:newId('reminder'), title:get('title'), projectId:get('project'), due:get('due'), kind:get('kind') as Reminder['kind'] };
    change(data => ({ ...data, reminders:[...data.reminders,item] }), 'یادآوری ثبت شد.', { projectId:item.projectId, title:item.title, source:'تقویم' });
    onClose();
  }
  return <Modal title="رویداد جدید" onClose={onClose}><form className="form-stack" onSubmit={submit}>
    <Field label="عنوان رویداد"><input autoFocus required name="title" maxLength={90} /></Field>
    <ProjectField initial={projectId} />
    <div className="form-grid">
      <Field label="نوع رویداد"><select name="kind"><SelectOptions options={['یادآوری','جلسه','تمدید']} /></select></Field>
      <Field label="موعد (میلادی)"><input dir="ltr" required name="due" type="date" defaultValue={due ?? today()} /></Field>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <FormActions onClose={onClose} submit="ثبت رویداد" />
  </form></Modal>;
}

export const projectName = (data: DemoData, id: string) => data.projects.find(p => p.id === id)?.name ?? 'فضای کاری';
