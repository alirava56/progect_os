import { randomUUID } from 'node:crypto';
import { validRecordId } from '../record-contract';
import { ForbiddenError, lockWorkspace, projectPolicy, storedRecord, transaction, type Account } from './db';
import { suspiciousCredential } from './credential-guard';

export class ActivityValidationError extends Error {}
export class ActivityRateLimitError extends Error {}

export async function appendManualActivity(account: Account, input: unknown) {
  if (account.role !== 'owner') throw new ForbiddenError();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ActivityValidationError();
  const { projectId, title, detail } = input as Record<string, unknown>;
  if (!validRecordId(projectId) || typeof title !== 'string' || typeof detail !== 'string'
    || !title.trim() || !detail.trim() || title.length > 120 || detail.length > 1200
    || suspiciousCredential(title) || suspiciousCredential(detail)) throw new ActivityValidationError();
  return transaction(async db => {
    if (!await lockWorkspace(db, account.workspaceId)) throw new ForbiddenError();
    await projectPolicy(db, account);
    if (!await storedRecord(db, account.workspaceId, 'projects', projectId)) throw new ActivityValidationError();
    const hourly = new Date(Date.now() - 3600_000).toISOString();
    const recent = await db.one<{n: number}>(`SELECT COUNT(*) AS n FROM audit_events
      WHERE workspace_id=? AND actor_id=? AND kind='manual' AND created_at>=?`, account.workspaceId, account.id, hourly);
    if ((recent?.n ?? 0) >= 30) throw new ActivityRateLimitError();
    const id = randomUUID();
    await db.run(`INSERT INTO audit_events(id,workspace_id,actor_id,kind,record_id,action,title,project_id,created_at,actor_snapshot)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, id, account.workspaceId, account.id, 'manual', projectId, detail.trim(), title.trim(),
    projectId, new Date().toISOString(), account.displayName);
    return id;
  });
}