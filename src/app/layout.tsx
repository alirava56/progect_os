import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import './screens.css';
import { DemoProvider } from '@/lib/store';
import { getCurrentAccount } from '@/lib/server/auth';
import { loadState } from '@/lib/server/db';
import { emptyData } from '@/lib/empty-data';

export const metadata: Metadata = {
  title: { default: 'ProjectOS', template: '%s | ProjectOS' },
  description: 'مدیریت پروژه‌ها، وظایف و زیرساخت با ذخیره‌سازی امن و پایدار',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user=await getCurrentAccount();
  const state=user?loadState(user):{data:emptyData,version:0};
  return <html lang="fa" dir="rtl"><body><DemoProvider initialData={state.data} initialVersion={state.version} authenticated={!!user}>{children}</DemoProvider></body></html>;
}
