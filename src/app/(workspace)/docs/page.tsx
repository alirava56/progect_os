import { Suspense } from 'react';
import Loading from '../loading';
import { Docs } from '@/components/knowledge';

export const metadata = { title: 'مستندات' };

export default function Page() {
  return <Suspense fallback={<Loading />}><Docs /></Suspense>;
}
