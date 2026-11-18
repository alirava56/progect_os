import { Suspense } from 'react';
import Loading from '../loading';
import { Infrastructure } from '@/components/infrastructure';

export const metadata = { title: 'زیرساخت' };

export default function Page() {
  return <Suspense fallback={<Loading />}><Infrastructure /></Suspense>;
}
