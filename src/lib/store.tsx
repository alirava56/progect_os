'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptyData } from './empty-data';
import { recordKinds, type RecordChange } from './record-contract';
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

function changesBetween(previous: DemoData, next: DemoData) {
  const changes: RecordChange[] = [];
  for (const kind of recordKinds) {
    const previousById = new Map(previous[kind].map(record => [record.id, record]));
    for (const record of next[kind]) {
      const existing = previousById.get(record.id);
      if (!existing) changes.push({ kind, id: record.id, action: 'create', record });
      else if (JSON.stringify(existing) !== JSON.stringify(record)) changes.push({ kind, id: record.id, action: 'replace', record });
      previousById.delete(record.id);
    }
    for (const id of previousById.keys()) changes.push({ kind, id, action: 'delete' });
  }
  return changes;
}

export function DemoProvider({ children, initialData, initialVersion = 0, authenticated = false }: {
  children: ReactNode; initialData?: DemoData; initialVersion?: number; authenticated?: boolean;
}) {
  const [data, setData] = useState(() => structuredClone(initialData ?? emptyData));
  const dataRef = useRef(data);
  const revision = useRef(initialVersion);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [projectScope, setProjectScope] = useState('');
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  async function refreshState() {
    const response = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Refresh failed');
    const snapshot = await response.json() as { data: DemoData; version: number };
    dataRef.current = snapshot.data;
    revision.current = snapshot.version;
    setData(snapshot.data);
  }

  const change: Store['change'] = (mutator, text) => {
    if (!authenticated) { notice('برای ذخیره اطلاعات، ابتدا وارد حساب خود شوید.'); return; }
    if (dataRef.current.users[0]?.role === 'Viewer') { notice('حساب شما فقط مجوز مشاهده دارد.'); return; }
    const previous = dataRef.current;
    const version = revision.current;
    let next: DemoData;
    try { next = mutator(structuredClone(previous)); }
    catch { notice('انجام تغییر امکان‌پذیر نبود.'); return; }

    const changes = changesBetween(previous, next);
    const preferences = JSON.stringify(previous.preferences) === JSON.stringify(next.preferences) ? undefined : next.preferences;
    if (!changes.length && !preferences) return;
    const body = JSON.stringify({ version, changes, preferences });
    setSaving(true);
    pending.current++;
    queue.current = queue.current.then(async () => {
      let confirmed = false;
      try {
        const response = await fetch('/api/records', {
          method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body,
        });
        if (response.status === 409) {
          await refreshState();
          setSyncError('رکورد تغییر کرده است. آخرین نسخه دریافت شد. تغییر را دوباره بررسی و ثبت کنید.');
          return;
        }
        if (!response.ok) {
          setSyncError(response.status === 403
            ? 'حساب شما اجازهٔ انجام این تغییر را ندارد.'
            : 'سرور تغییر را نپذیرفت. ورودی‌ها را بررسی کنید و دوباره تلاش کنید.');
          return;
        }
        confirmed = true;
        await refreshState();
        setSyncError(null);
        notice(text);
      } catch {
        setSyncError(confirmed
          ? 'تغییر ذخیره شد. برای دریافت آخرین داده‌ها، صفحه را تازه کنید.'
          : 'نتیجهٔ ذخیره تأیید نشد. پیش از تلاش مجدد، صفحه را تازه کنید.');
      }
    }).finally(() => {
      pending.current--;
      if (!pending.current) setSaving(false);
    });
  };

  return <DemoContext.Provider value={{ data, change, notice, projectScope, setProjectScope, saving, syncError }}>
    {children}
    {authenticated && (saving || syncError) && <div className="sync-status" role="status" aria-live="polite">
      {syncError ? <><span>{syncError}</span><button onClick={() => location.reload()}>بارگذاری دوباره</button></>
        : 'در حال ذخیره تغییرات…'}
    </div>}
    <div className="toast-container" role="status" aria-live="polite">{message && <div className="toast">{message}</div>}</div>
  </DemoContext.Provider>;
}

export function useDemo() {
  const store = useContext(DemoContext);
  if (!store) throw new Error('DemoProvider missing');
  return store;
}
export function savePreferences(preferences: Preferences) { return Boolean(preferences); }