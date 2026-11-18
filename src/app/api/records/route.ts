import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, getCurrentAccount, readLimitedJson } from '@/lib/server/auth';
import { invalidRecordBody, recordError, recordFailure, recordHeaders } from '@/lib/server/record-http';
import { commitRecordChanges } from '@/lib/server/record-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return recordError('Unauthenticated', 401);
  if (!checkOrigin(request)) return recordError('Origin rejected', 403);
  let payload: unknown;
  try { payload = await readLimitedJson(request, 2 * 1024 * 1024); }
  catch (error) { return invalidRecordBody(error); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some(key => !['version', 'changes', 'preferences'].includes(key))) {
    return recordError('Invalid body', 400);
  }
  const { version, changes, preferences } = payload as {version?: unknown; changes?: unknown; preferences?: unknown};
  if (!Number.isSafeInteger(version) || Number(version) < 0) return recordError('Invalid revision', 400);
  try {
    const committedVersion = await commitRecordChanges(account, Number(version), changes, preferences);
    return NextResponse.json({ ok: true, version: committedVersion }, { headers: recordHeaders });
  } catch (error) {
    return recordFailure(error);
  }
}