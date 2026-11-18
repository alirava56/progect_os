import { NextRequest, NextResponse } from 'next/server';
import { authRate, authenticate, checkOrigin, newSession, readLimitedJson, requireMfa, setSessionCookie } from '@/lib/server/auth';
import { accountByUser, transaction } from '@/lib/server/db';
import { apiError, jsonError, noStore } from '@/lib/server/http';
import { lockIdentity, mfaEnabled, verifyMfa, verifyRecoveryCode } from '@/lib/server/mfa';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return apiError('Origin rejected', 403);
  const quota = await authRate(request, 'login');
  if (!quota.allowed) return apiError('Try again later', 429, { 'Retry-After': String(quota.retryAfter) });
  let input: unknown;
  try { input = await readLimitedJson(request); }
  catch (error) { return jsonError(error); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return apiError('Invalid credentials', 401);
  const body = input as { email?: unknown; password?: unknown; totp?: unknown; recoveryCode?: unknown };
  const id = await authenticate(body.email, body.password);
  if (!id) return apiError('Invalid credentials or second factor', 401);
  const result = await transaction(async db => {
    await lockIdentity(db, id);
    if (!await accountByUser(id, db)) return;
    const enabled = await mfaEnabled(id, db);
    const recovery = typeof body.recoveryCode === 'string' && body.recoveryCode.length > 0;
    if (enabled && !await (recovery ? verifyRecoveryCode(id, body.recoveryCode, db) : verifyMfa(id, body.totp, db))) return;
    return { token: await newSession(id, db), enrollmentRequired: !enabled && requireMfa(), recoveryUsed: recovery && enabled };
  });
  if (!result) return apiError('Invalid credentials or second factor', 401);
  await setSessionCookie(result.token);
  return NextResponse.json({ ok: true, recoveryUsed: result.recoveryUsed, enrollmentRequired: result.enrollmentRequired }, { headers: noStore });
}