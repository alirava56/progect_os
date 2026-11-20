import { notFound } from 'next/navigation';
import { ActivityLog } from '@/components/activity';
import { validRecordId } from '@/lib/record-contract';
import { getCurrentAccount } from '@/lib/server/auth';
import { loadActivityById } from '@/lib/server/db';

export const metadata = { title: 'تاریخچه فعالیت‌ها' };

export default async function Page({searchParams}:{searchParams:Promise<{event?:string|string[]}>}) {
  const {event}=await searchParams;
  if (event===undefined) return <ActivityLog/>;
  if (!validRecordId(event)) notFound();
  const account=await getCurrentAccount();
  const selected=account && await loadActivityById(account,event);
  if (!selected) notFound();
  return <ActivityLog selected={selected}/>;
}
