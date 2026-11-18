import type { DemoData, Project } from './types';
export interface ProjectCheck { id:string;label:string;complete:boolean;detail:string;href:string }
/** Coverage of manually recorded information; it is NOT a verified health or security score. */
export function projectCompleteness(data:DemoData,project:Project):{items:ProjectCheck[];percent:number}{
  const pid=project.id;
  const resources=data.resources.filter(r=>r.projectId===pid||r.linkedProjectIds?.includes(pid));
  const docs=data.docs.filter(d=>d.projectId===pid);
  const tasks=data.tasks.filter(t=>t.projectId===pid);
  const remind=data.reminders.filter(r=>r.projectId===pid);
  const secrets=data.secrets.filter(s=>s.projectId===pid);
  const items:ProjectCheck[]=[
    {id:'description',label:'شرح و هدف پروژه',complete:!!project.description.trim(),detail:'برای بازگشت به پروژه بعد از وقفه ضروری است',href:`/projects/${encodeURIComponent(pid)}`},
    {id:'tasks',label:'حداقل یک وظیفه و قدم بعدی',complete:tasks.length>0,detail:'برنامه انجام کارها و مسئله‌های باز',href:'/tasks'},
    {id:'resources',label:'ثبت منابع و سرویس‌های فنی',complete:resources.length>0,detail:'سرور، دامنه، دیتابیس یا مخزن کد',href:'/infrastructure'},
    {id:'docs',label:'حداقل یک مستند یا Runbook',complete:docs.length>0,detail:'تصمیم‌ها و روش بازیابی دانش',href:'/docs'},
    {id:'renewal',label:'موعد تمدید یا بازبینی ثبت شده',complete:remind.length>0||resources.some(r=>!!r.expires),detail:'تاریخ سررسید و یادآوری',href:'/calendar'},
    {id:'secret',label:'محل امن دسترسی‌ها مشخص شده',complete:secrets.length>0,detail:'فقط ارجاع به Vault، نه خود رمز',href:'/vault'},
  ];
  return {items,percent:Math.round(items.filter(x=>x.complete).length/items.length*100)};
}
