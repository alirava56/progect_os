import { NextRequest, NextResponse } from 'next/server';
import { authRate, checkOrigin, newSession, readLimitedJson, requireMfa, setSessionCookie, setupOwner } from '@/lib/server/auth';
import { apiError, jsonError, noStore } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return apiError('Origin rejected', 403);
  const quota = await authRate(request, 'setup');
  if (!quota.allowed) return apiError('Try again later', 429, { 'Retry-After': String(quota.retryAfter) });
  let input: unknown;
  try { input = await readLimitedJson(request); }
  catch (error) { return jsonError(error); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return apiError('Invalid request', 400);
  try {
    const id = await setupOwner(input as Parameters<typeof setupOwner>[0]);
    await setSessionCookie(await newSession(id));
    return NextResponse.json({ ok: true, enrollmentRequired: requireMfa() }, { headers: noStore });
  } catch {
    return apiError('Setup rejected', 400);
  }
}