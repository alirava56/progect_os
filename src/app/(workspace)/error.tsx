'use client';

import { Button, Empty } from '@/components/ui';

export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return <Empty title="بارگذاری صفحه با خطا مواجه شد" action={<Button onClick={reset}>تلاش دوباره</Button>} />;
}
