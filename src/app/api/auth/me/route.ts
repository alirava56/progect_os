import { NextResponse } from 'next/server';
import { getSessionAccount, requireMfa, userCount } from '@/lib/server/auth';
import { noStore } from '@/lib/server/http';
import { mfaEnabled } from '@/lib/server/mfa';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSessionAccount();
  const enrollmentRequired = Boolean(session && requireMfa() && !await mfaEnabled(session.id));
  const account = session && !enrollmentRequired
    ? { email: session.email, displayName: session.displayName, role: session.role }
    : null;
  return NextResponse.json({ authenticated: Boolean(account), account, enrollmentRequired, setupRequired: await userCount() === 0 },
    { headers: noStore });
}