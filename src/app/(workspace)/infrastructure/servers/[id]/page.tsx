import { ServerDetails } from '@/components/infrastructure';

export const metadata = { title: 'جزئیات سرور' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServerDetails id={id} />;
}
