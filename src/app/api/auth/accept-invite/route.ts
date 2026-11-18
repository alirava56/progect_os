import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitation } from '@/lib/server/invitations';
import { authRate, checkOrigin, newSession, readLimitedJson, requireMfa, setSessionCookie } from '@/lib/server/auth';
import { apiError, jsonError, noStore } from '@/lib/server/http';
import { mfaEnabled } from '@/lib/server/mfa';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return apiError('Origin rejected', 403);
  const quota = await authRate(request, 'invite-acceptance');
  if (!quota.allowed) return apiError('Try again later', 429, { 'Retry-After': String(quota.retryAfter) });
  let input: unknown;
  try { input = await readLimitedJson(request, 2048); }
  catch (error) { return jsonError(error); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return apiError('Invalid invitation body', 400);
  try {
    const id = await acceptInvitation(input as Parameters<typeof acceptInvitation>[0]);
    await setSessionCookie(await newSession(id));
    return NextResponse.json({ ok: true, enrollmentRequired: requireMfa() && !await mfaEnabled(id) }, { headers: noStore });
  } catch {
    return apiError('Invitation is invalid, expired or already used', 422);
  }
}