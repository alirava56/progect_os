import { LoaderCircle } from 'lucide-react';
export default function Loading() {
  return <div className="empty" role="status"><LoaderCircle className="animate-spin" />در حال بارگذاری صفحه…</div>;
}
