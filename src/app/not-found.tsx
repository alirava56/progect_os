import { Empty, LinkButton } from '@/components/ui';
export default function NotFound() {
  return <main className="auth-center"><Empty title="صفحه پیدا نشد" action={<LinkButton href="/dashboard">بازگشت به داشبورد</LinkButton>} /></main>;
}
