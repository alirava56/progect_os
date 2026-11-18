import { NextRequest, NextResponse } from 'next/server';
import { validRecordId } from '@/lib/record-contract';
import { checkOrigin, getCurrentAccount, readLimitedJson } from '@/lib/server/auth';
import { apiError, jsonError, noStore } from '@/lib/server/http';
import { createInvitation, listInvitations, revokeInvitation } from '@/lib/server/invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner') return apiError('Forbidden', 403);
  return NextResponse.json({ invitations: await listInvitations(account) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner' || !checkOrigin(request)) return apiError('Forbidden', 403);
  let input: unknown;
  try { input = await readLimitedJson(request, 16_000); }
  catch (error) { return jsonError(error); }
  try {
    const body = input as { email?: unknown; role?: unknown; projectIds?: unknown };
    return NextResponse.json(await createInvitation(account, body?.email, body?.role, body?.projectIds), { headers: noStore });
  } catch {
    return apiError('Invitation rejected', 422);
  }
}

export async function DELETE(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return apiError('Unauthenticated', 401);
  if (account.role !== 'owner' || !checkOrigin(request)) return apiError('Forbidden', 403);
  let input: unknown;
  try { input = await readLimitedJson(request, 512); }
  catch (error) { return jsonError(error); }
  const id = (input as { id?: unknown })?.id;
  if (!validRecordId(id)) return apiError('Invalid invitation', 422);
  return NextResponse.json({ revoked: await revokeInvitation(account, id) }, { headers: noStore });
}