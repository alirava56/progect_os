import { redirect } from 'next/navigation';
import { MfaSettings } from '@/components/administration';
import { Mark } from '@/components/shell';
import { Heading, Panel } from '@/components/ui';
import { getSessionAccount } from '@/lib/server/auth';
import { mfaEnabled } from '@/lib/server/mfa';

export const metadata = { title: 'فعال‌سازی ورود دومرحله‌ای' };

export default async function Page() {
  const account = await getSessionAccount();
  if (!account) redirect('/login');
  return <main className="auth-layout"><div className="auth-form"><div className="auth-form-inner">
    <Mark />
    <Heading title="فعال‌سازی ورود دومرحله‌ای" subtitle="برای دسترسی به فضای کاری، حساب را در برنامهٔ تأیید هویت فعال کنید." />
    <Panel><MfaSettings enrollmentRequired initiallyEnabled={await mfaEnabled(account.id)} /></Panel>
  </div></div></main>;
}