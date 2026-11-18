'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyData } from './empty-data';
import { newId, now } from './format';
import type { ActivityEvent, DemoData, Preferences } from './types';

interface Store {
  data: DemoData;
  change: (mutator: (data: DemoData) => DemoData, message: string, event?: Pick<ActivityEvent, 'projectId' | 'title' | 'source'> & { detail?: string }) => void;
  notice: (message: string) => void;
  projectScope: string;
  setProjectScope: (id: string) => void;
  saving: boolean;
  syncError: string | null;
}
const DemoContext = createContext<Store | null>(null);

export function DemoProvider({ children, initialData, initialVersion=0, authenticated=false }: {children:ReactNode;initialData?:DemoData;initialVersion?:number;authenticated?:boolean}) {
  const [data, setData] = useState<DemoData>(()=>structuredClone(initialData??emptyData));
  const dataRef = useRef(data);
  const revision = useRef(initialVersion);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const broken = useRef(false);
  const [saving,setSaving]=useState(false);
  const [syncError,setSyncError]=useState<string|null>(null);
  const [projectScope, setProjectScope] = useState('');
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending=useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    document.documentElement.dataset.theme = data.preferences.theme;
    document.documentElement.dataset.numerals = data.preferences.language;
  }, [data.preferences.theme, data.preferences.language]);

  const notice = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 5500);
  }, []);

  const change: Store['change'] = (mutator, text, event) => {
    if (!authenticated) { notice('برای ذخیره اطلاعات، ابتدا وارد حساب خود شوید.'); return; }
    if(broken.current) {notice('ذخیره‌سازی متوقف شد. برای جلوگیری از از دست رفتن داده صفحه را بازخوانی کنید.');return;}
    const previous=structuredClone(dataRef.current);
    let next:DemoData;
    try {
      next=mutator(structuredClone(previous));
    }catch {notice('انجام تغییر امکان‌پذیر نبود.');return;}
    const role=initialData?.users[0]?.role??'Viewer';
    if(role==='Viewer'){notice('حساب شما فقط مجوز مشاهده دارد.');return;}
    let recordEdit:{kind:string;id:string;action:'create'|'replace'|'delete';record?:unknown}|null=null;
    if(role==='Developer'){
      if(JSON.stringify(next.preferences)!==JSON.stringify(previous.preferences)){
        notice('ویرایش تنظیمات فقط برای مالک مجاز است.');return;
      }
      const allowed=['tasks','docs','reminders','incidents'] as const;
      const allKinds=['projects','tasks','resources','secrets','reminders','incidents','expenses','charges','contracts','revenues','docs'] as const;
      const changes:Array<{kind:string;id:string;action:'create'|'replace'|'delete';record?:unknown}>=[];
      for(const kind of allKinds){
        const oldItems=previous[kind] as Array<{id:string}>,newItems=next[kind] as Array<{id:string}>;
        const oldMap=new Map(oldItems.map(item=>[item.id,item]));
        const newMap=new Map(newItems.map(item=>[item.id,item]));
        for(const item of oldItems)if(!newMap.has(item.id))changes.push({kind,id:item.id,action:'delete'});
        for(const item of newItems){
          if(!oldMap.has(item.id))changes.push({kind,id:item.id,action:'create',record:item});
          else if(JSON.stringify(oldMap.get(item.id))!==JSON.stringify(item))changes.push({kind,id:item.id,action:'replace',record:item});
        }
      }
      if(changes.length!==1||!allowed.includes(changes[0].kind as typeof allowed[number])){
        notice('این عملیات برای نقش توسعه‌دهنده مجاز نیست یا چند رکورد را هم‌زمان تغییر می‌دهد.');return;
      }
      recordEdit=changes[0];
    }
    if(event) {
      const evt:ActivityEvent={id:newId('local-event'),date:now(),actor:next.preferences.displayName,detail:event.detail||text,...event};
      next={...next,events:[evt,...next.events]};
    }
    dataRef.current=next;
    setData(next);
    setSaving(true);
    pending.current++;
    const snapshot=structuredClone(next);
    queue.current=queue.current.then(async()=>{
      if(broken.current)return;
      const response=await fetch(recordEdit?`/api/records/${encodeURIComponent(recordEdit.kind)}/${encodeURIComponent(recordEdit.id)}`:'/api/state',{
        method:recordEdit?(recordEdit.action==='create'?'POST':recordEdit.action==='delete'?'DELETE':'PUT'):'PUT',
        credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:recordEdit?JSON.stringify({version:revision.current,record:recordEdit.record}):JSON.stringify({version:revision.current,data:snapshot}),
      });
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json() as {version:number};
      revision.current=payload.version;
      if(pending.current===1)notice(text);
    }).catch((error:unknown)=>{
      broken.current=true;
      const message=error instanceof Error?error.message:'Network error';
      setSyncError(`تغییرات جدید ذخیره نشدند (${message}). برای جلوگیری از تداخل، صفحه را بازخوانی کنید.`);
      notice('خطا در ذخیره‌سازی. تغییرات فعلی تأیید نشده‌اند.');
    }).finally(()=>{
      pending.current=Math.max(0,pending.current-1);
      if(pending.current===0)setSaving(false);
    });
  };
  return <DemoContext.Provider value={{ data, change, notice, projectScope, setProjectScope, saving, syncError }}>
    {children}
    {authenticated && (saving||syncError) && <div className="sync-status" role="status" aria-live="polite">{syncError ? <><strong>ذخیره ناموفق</strong><span>{syncError}</span><button onClick={()=>location.reload()}>بارگذاری دوباره</button></> : 'در حال ذخیره تغییرات…'}</div>}
    <div className="toast-container" role="status" aria-live="polite">{message && <div className="toast">{message}</div>}</div>
  </DemoContext.Provider>;
}

export function useDemo() {
  const store = useContext(DemoContext);
  if (!store) throw new Error('DemoProvider missing');
  return store;
}
// The UI still calls this helper, but persistence is handled solely by the authenticated server API.
// Never copy workspace information into LocalStorage.
export function savePreferences(preferences: Preferences) { return !!preferences; }
