'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Activity, Bell, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronLeft, Clock3, FileText,
  FolderKanban, Layers2, LayoutDashboard, ListTodo, LogOut, Menu, Plus, Plug2, ReceiptText, Search,
  Server, Settings, ShieldCheck, Sparkles, Users, PanelTopOpen,
} from 'lucide-react';
import { useDemo } from '@/lib/store';
import { docHref, matches, number, projectHref, serverHref, taskHref } from '@/lib/format';
import { incidentStates } from '@/lib/labels';
import { Art, Empty, Glyph, IconButton, Modal, Row, SearchField, TextLink } from './ui';
import { ProjectForm, ReminderForm, ResourceForm, TaskForm } from './forms';

const groups = [
  { label:'فضای کاری', links:[
    { path:'/dashboard', label:'داشبورد', Icon:LayoutDashboard, short:'خانه' },
    { path:'/projects', label:'پروژه‌ها', Icon:FolderKanban, short:'پروژه‌ها' },
    { path:'/tasks', label:'مدیریت وظایف', Icon:ListTodo, short:'کارها' },
    { path:'/calendar', label:'تقویم', Icon:CalendarDays },
  ]},
  { label:'زیرساخت', links:[
    { path:'/infrastructure', label:'زیرساخت', Icon:Server, short:'زیرساخت' },
    { path:'/vault', label:'خزانه دسترسی‌ها', Icon:ShieldCheck },
    { path:'/monitoring', label:'مانیتورینگ', Icon:Activity },
    { path:'/alerts', label:'هشدارها', Icon:Bell },
  ]},
  { label:'مدیریت و دانش', links:[
    { path:'/docs', label:'مستندات و ویکی', Icon:FileText },
    { path:'/assistant', label:'دستیار پروژه', Icon:Sparkles },
    { path:'/finance', label:'هزینه‌ها و قراردادها', Icon:ReceiptText },
    { path:'/reports', label:'گزارش‌ها و تحلیل', Icon:ChartNoAxesCombined },
  ]},
  { label:'سیستم', links:[
    { path:'/activity', label:'تاریخچه فعالیت‌ها', Icon:Clock3 },
    { path:'/integrations', label:'اتصال سرویس‌ها', Icon:Plug2 },
    { path:'/team', label:'کاربران و دسترسی‌ها', Icon:Users },
    { path:'/settings', label:'تنظیمات', Icon:Settings, short:'تنظیمات' },
  ]},
];
const links = groups.flatMap(group => group.links);
type Overlay = 'search' | 'nav' | 'account' | 'notifications' | 'quick' | 'projects' | 'project' | 'task' | 'resource' | 'reminder';
const isActive = (path: string, current: string) => current === path || current.startsWith(path + '/');
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function Mark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true"><Layers2 /></span>;
}
export function Brand() {
  return <Link className="brand" href="/dashboard" prefetch={false}>
    <Mark /><span dir="ltr"><strong>Project<span>OS</span></strong><small>Developer Command Center</small></span>
  </Link>;
}

function Navigation({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  const { data } = useDemo();
  const alerts = data.incidents.filter(a => a.state === 'open').length;
  return <nav className="side-nav" aria-label="منوی اصلی">{groups.map(group => <div className="nav-group" key={group.label}>
    <div>{group.label}</div>
    {group.links.map(({ path, label, Icon }) => <Link key={path} onClick={onNavigate} href={path} prefetch={false}
      className={`nav-link ${isActive(path, current) ? 'is-active' : ''}`} aria-current={isActive(path, current) ? 'page' : undefined}>
      <Icon aria-hidden="true" /><span>{label}</span>{path === '/alerts' && alerts > 0 && <small>{number(alerts)}</small>}
    </Link>)}
  </div>)}</nav>;
}
function GlobalSearch({ close }: { close: () => void }) {
  const { data } = useDemo();
  const [query, setQuery] = useState('');
  const results = [
    ...data.projects.map(x => ({ title:x.name, detail:'پروژه', match:x.subtitle, href:projectHref(x.id), Icon:FolderKanban })),
    ...data.tasks.map(x => ({ title:x.title, detail:'وظیفه', match:x.id, href:taskHref(x.id), Icon:ListTodo })),
    ...data.resources.filter(r => r.type === 'server').map(x => ({ title:x.name, detail:'سرور', match:x.address, href:serverHref(x.id), Icon:Server })),
    ...data.docs.map(x => ({ title:x.title, detail:'مستند', match:x.body, href:docHref(x.id), Icon:FileText })),
  ].filter(x => matches(query, x.title, x.detail, x.match)).slice(0, 9);
  return <Modal title="جست‌وجوی فضای کاری" onClose={close}>
    <SearchField label="جست‌وجوی پروژه، وظیفه، سرور یا سند" value={query} onChange={setQuery} autoFocus />
    <div className="search-results">{results.length === 0 && <Empty title="نتیجه‌ای پیدا نشد" detail="نام یا شناسهٔ دیگری را امتحان کنید." />}
      {results.map(({ title, detail, href, Icon }) => <Link className="item-row item-interactive" key={href} href={href} onClick={close}>
        <Glyph icon={Icon} /><span className="row-copy"><strong dir="auto">{title}</strong><small>{detail}</small></span><ChevronLeft size={16} aria-hidden="true" />
      </Link>)}</div>
  </Modal>;
}

export function Shell({ children }: { children: ReactNode }) {
  const current = usePathname();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const { data, projectScope, setProjectScope, saving, syncError, notice } = useDemo();
  const parent = links.find(link => isActive(link.path, current));
  const project = data.projects.find(p => p.id === projectScope);
  const detail = current.split('/').filter(Boolean).length > 1;
  const crumb = detail ? ({ '/projects':'جزئیات پروژه','/infrastructure':'جزئیات سرور','/tasks':'جزئیات وظیفه' }[parent?.path ?? '']) : undefined;
  const openAlerts = data.incidents.filter(item => item.state === 'open');
  const close = () => setOverlay(null);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOverlay(previous => previous === null ? 'search' : previous);
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  return <div className="app-shell">
    <a href="#page-content" className="skip-link">رفتن به محتوای صفحه</a>
    <aside className="sidebar"><Brand /><Navigation current={current} />
      <div className="workspace-footer">
        <button className="workspace-switch" type="button" disabled={!interactive} onClick={() => setOverlay('projects')} aria-haspopup="dialog">
          <span className="avatar"><PanelTopOpen size={16} aria-hidden="true" /></span><span className="row-copy"><strong>{project?.name ?? data.preferences.workspace}</strong><small>جابه‌جایی بین پروژه‌ها</small></span><ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>
    <div className="workspace-main">
      <header className="topbar">
        <div className="top-start"><IconButton className="mobile-menu" icon={Menu} label="منوی اصلی" disabled={!interactive} onClick={() => setOverlay('nav')} />
          <nav aria-label="مسیر صفحه" className="breadcrumb">
            <Link className="crumb-brand" href="/dashboard" dir="ltr" prefetch={false}>ProjectOS</Link><ChevronLeft size={13} aria-hidden="true" />
            {crumb && parent ? <><Link href={parent.path} prefetch={false}>{parent.label}</Link><ChevronLeft size={13} aria-hidden="true" /><span aria-current="page">{crumb}</span></> :
              <span aria-current="page">{parent?.label ?? 'راه‌اندازی'}</span>}
          </nav>
        </div>
        <div className="top-tools">
          <button className="top-search" type="button" disabled={!interactive} onClick={() => setOverlay('search')} title="جست‌وجوی فضای کاری">
            <Search size={16} aria-hidden="true" /><span>جست‌وجوی فضای کاری</span><kbd dir="ltr" aria-hidden="true">Ctrl K</kbd>
          </button>
          <IconButton icon={Plus} label="افزودن سریع" disabled={!interactive} onClick={() => setOverlay('quick')} />
          <IconButton icon={Bell} className={openAlerts.length ? 'has-alerts' : ''} label="اعلان‌ها" disabled={!interactive} onClick={() => setOverlay('notifications')} />
          <button className="avatar avatar-button" aria-label="حساب کاربری" type="button" disabled={!interactive} onClick={() => setOverlay('account')}><span dir="ltr">A</span></button>
        </div>
      </header>
      <main className="page-content" id="page-content" tabIndex={-1} key={current}>{children}
        <footer className="page-footer"><i />نسخه خصوصی توسعه<span>·</span> {syncError ? 'خطا در ذخیره‌سازی' : saving ? 'در حال ذخیره' : 'اطلاعات در فضای کاری ذخیره می‌شوند'}</footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="دسترسی سریع">{links.filter(link => link.short).map(({ path, Icon, short }) => <Link key={path} className={isActive(path, current) ? 'is-active' : ''} aria-current={isActive(path,current) ? 'page' : undefined} href={path} prefetch={false}><Icon aria-hidden="true" /><span>{short}</span></Link>)}</nav>

    {overlay === 'nav' && <Modal title="فضای کاری" onClose={close} align="drawer"><Navigation current={current} onNavigate={close} /><div className="modal-footer"><button type="button" className="button button-soft" onClick={() => setOverlay('projects')}>جابه‌جایی بین پروژه‌ها</button></div></Modal>}
    {overlay === 'search' && <GlobalSearch close={close} />}
    {overlay === 'quick' && <Modal title="افزودن سریع" onClose={close}>
      <Row title="پروژه جدید" icon={FolderKanban} onClick={() => setOverlay('project')} />
      <Row title="وظیفه جدید" icon={ListTodo} onClick={() => setOverlay('task')} />
      <Row title="ثبت منبع زیرساخت" icon={Server} onClick={() => setOverlay('resource')} />
      <Row title="ثبت یادآوری" icon={CalendarDays} onClick={() => setOverlay('reminder')} />
    </Modal>}
    {overlay === 'project' && <ProjectForm onClose={close} />}
    {overlay === 'task' && <TaskForm onClose={close} projectId={projectScope} />}
    {overlay === 'resource' && <ResourceForm onClose={close} projectId={projectScope} />}
    {overlay === 'reminder' && <ReminderForm onClose={close} projectId={projectScope} />}
    {overlay === 'notifications' && <Modal title="اعلان‌های ثبت‌شده" onClose={close}>
      {openAlerts.length ? openAlerts.map(alert => <Row key={alert.id} icon={Bell} title={alert.title} meta={incidentStates[alert.state]} />) : <Empty title="اعلان بازی ندارید" />}
      <div className="modal-footer" onClick={close}><TextLink href="/alerts">رفتن به هشدارها</TextLink></div>
    </Modal>}
    {overlay === 'account' && <Modal title="حساب کاربری" onClose={close}>
      <div className="account-summary"><span className="avatar">A</span><div><strong>{data.preferences.displayName}</strong><small dir="ltr">{data.users[0]?.email??''}</small></div></div>
      <Link onClick={close} className="item-row item-interactive" href="/settings"><Glyph icon={Settings} />تنظیمات حساب</Link>
      <Link onClick={close} className="item-row item-interactive" href="/onboarding"><Glyph icon={PanelTopOpen} />راه‌اندازی فضای کاری</Link>
      <button type="button" className="item-row item-interactive" onClick={async()=>{
        try {
          const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
          if(!response.ok)throw new Error('Session revocation failed');
          close();
          // Full navigation is intentional to clear the authenticated root layout state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign('/login');
        }catch{notice('خروج انجام نشد؛ وضعیت نشست را بررسی کنید و دوباره تلاش کنید.');}
      }}><Glyph icon={LogOut} />خروج امن</button>
    </Modal>}
    {overlay === 'projects' && <Modal title="انتخاب محدودهٔ پروژه در فهرست‌ها" onClose={close}>
      <Row title="همه پروژه‌ها" icon={Layers2} end={!projectScope ? 'انتخاب‌شده' : undefined} onClick={() => {setProjectScope(''); close();}} />
      {data.projects.filter(p => p.status !== 'archived').map(p => <Row key={p.id} title={<bdi>{p.name}</bdi>} meta={p.subtitle} end={p.id === projectScope ? 'انتخاب‌شده' : <Art name={p.art} size={40} />} onClick={() => {setProjectScope(p.id); close();}} />)}
    </Modal>}
  </div>;
}
