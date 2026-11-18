import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import { getCurrentAccount, getSessionAccount } from '@/lib/server/auth';
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const account=await getCurrentAccount();
  if(!account)redirect(await getSessionAccount() ? '/mfa-enroll' : '/login');
  return <Shell>{children}</Shell>;
}
