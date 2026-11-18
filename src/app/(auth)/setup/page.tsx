import { Setup } from '@/components/setup';
import { getCurrentAccount, userCount } from '@/lib/server/auth';
import { redirect } from 'next/navigation';
export const metadata={title:'راه‌اندازی مالک اولیه'};
export default async function Page(){
  if(await getCurrentAccount())redirect('/dashboard');
  if(await userCount()>0)redirect('/login');
  return <Setup />;
}
