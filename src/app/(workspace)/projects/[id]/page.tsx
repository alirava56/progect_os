import { ProjectDetails } from '@/components/projects';

export const metadata = { title: 'جزئیات پروژه' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetails id={id} />;
}
