import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, getCurrentAccount, readLimitedJson } from '@/lib/server/auth';
import { apiError, jsonError, noStore } from '@/lib/server/http';
import { changeMemberScope, removeMember } from '@/lib/server/invitations';
import { validRecordId } from '@/lib/record-contract';

export const runtime = 'nodejs';
type Context = { params: Promise<{id: string}> };

export async function DELETE(request: NextRequest, context: Context) {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner' || !checkOrigin(request)) return apiError('Forbidden', 403);
  const { id } = await context.params;
  if (!validRecordId(id)) return apiError('Invalid member', 422);
  try {
    return NextResponse.json({ ok: await removeMember(account, id) }, { headers: noStore });
  } catch {
    return apiError('Cannot remove this member', 422);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner' || !checkOrigin(request)) return apiError('Forbidden', 403);
  const { id } = await context.params;
  if (!validRecordId(id)) return apiError('Invalid member', 422);
  let input: unknown;
  try { input = await readLimitedJson(request, 16_000); }
  catch (error) { return jsonError(error); }
  try {
    const changed = await changeMemberScope(account, id, (input as {projectIds?: unknown})?.projectIds);
    return changed ? NextResponse.json({ ok: true }, { headers: noStore }) : apiError('Not found', 404);
  } catch {
    return apiError('Invalid project grant', 422);
  }
}