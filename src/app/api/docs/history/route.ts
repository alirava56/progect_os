import { NextRequest, NextResponse } from 'next/server';
import { validRecordId } from '@/lib/record-contract';
import type { Doc } from '@/lib/types';
import { getCurrentAccount } from '@/lib/server/auth';
import { canSeeProject, projectPolicy, readTransaction, storedRecord } from '@/lib/server/db';
import { redactStoredValue } from '@/lib/server/credential-guard';
import { recordError, recordFailure, recordHeaders } from '@/lib/server/record-http';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return recordError('Unauthorized', 401);
  const id = request.nextUrl.searchParams.get('id');
  if (!validRecordId(id)) return recordError('Invalid document id', 400);
  try {
    const versions = await readTransaction(async db => {
      const policy = await projectPolicy(db, account);
      const current = await storedRecord(db, account.workspaceId, 'docs', id);
      if (!current || !canSeeProject(policy, current.project_id)) return;
      const revisions = await db.all<{payload: string; savedAt: string}>(`SELECT payload,saved_at AS "savedAt"
        FROM document_versions WHERE workspace_id=? AND document_id=? ORDER BY revision DESC LIMIT 100`, account.workspaceId, id);
      return revisions.flatMap(row => {
        const doc = JSON.parse(row.payload) as Doc;
        if (!canSeeProject(policy, doc.projectId)) return [];
        return [{ ...redactStoredValue(doc) as Doc, savedAt: row.savedAt }];
      });
    });
    return versions ? NextResponse.json({ versions }, { headers: recordHeaders }) : recordError('Not found', 404);
  } catch (error) {
    return recordFailure(error);
  }
}