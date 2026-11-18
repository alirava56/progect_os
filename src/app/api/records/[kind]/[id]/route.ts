import { NextRequest, NextResponse } from 'next/server';
import { isRecordKind, validRecordId, type RecordChange } from '@/lib/record-contract';
import { checkOrigin, getCurrentAccount, readLimitedJson } from '@/lib/server/auth';
import { loadRecord } from '@/lib/server/db';
import { invalidRecordBody, recordError, recordFailure, recordHeaders } from '@/lib/server/record-http';
import { mutateRecord } from '@/lib/server/record-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{kind: string; id: string}> };

export async function GET(_request: NextRequest, context: Context) {
  const account = await getCurrentAccount();
  if (!account) return recordError('Unauthenticated', 401);
  const { kind, id } = await context.params;
  if (!isRecordKind(kind) || !validRecordId(id)) return recordError('Not found', 404);
  try {
    const value = await loadRecord(account, kind, id);
    return value ? NextResponse.json(value, { headers: recordHeaders }) : recordError('Not found', 404);
  } catch (error) {
    return recordFailure(error);
  }
}

async function write(request: NextRequest, context: Context, action: RecordChange['action']) {
  const account = await getCurrentAccount();
  if (!account) return recordError('Unauthenticated', 401);
  if (!checkOrigin(request)) return recordError('Origin rejected', 403);
  const { kind, id } = await context.params;
  if (!isRecordKind(kind) || !validRecordId(id)) return recordError('Not found', 404);
  let body: unknown;
  try { body = await readLimitedJson(request, 450_000); }
  catch (error) { return invalidRecordBody(error); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return recordError('Invalid body', 400);
  const { version, record, concurrency } = body as { version?: unknown; record?: unknown; concurrency?: unknown };
  if (!Number.isSafeInteger(version) || Number(version) < 0
    || (concurrency !== undefined && concurrency !== 'record')
    || Object.keys(body).some(key => !['version', 'record', 'concurrency'].includes(key))) {
    return recordError('Invalid revision or concurrency mode', 400);
  }
  try {
    const saved = await mutateRecord(account, Number(version), kind, id, action, record, concurrency !== 'record');
    return NextResponse.json({ ok: true, version: saved, recordVersion: saved }, { headers: recordHeaders });
  } catch (error) {
    return recordFailure(error);
  }
}
export const POST = (request: NextRequest, context: Context) => write(request, context, 'create');
export const PUT = (request: NextRequest, context: Context) => write(request, context, 'replace');
export const DELETE = (request: NextRequest, context: Context) => write(request, context, 'delete');