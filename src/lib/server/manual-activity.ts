import { randomUUID } from 'node:crypto';
import { today } from '../format';
import { validRecordId } from '../record-contract';
import { ForbiddenError, lockWorkspace, persistChanges, projectPolicy, storedRecord, transaction, type Account } from './db';
import { suspiciousCredential } from './credential-guard';
import { parseRecord } from './validation';

export class ActivityValidationError extends Error {}
export class ActivityRateLimitError extends Error {}

export async function appendManualActivity(account: Account, input: unknown) {
  if (account.role !== 'owner') throw new ForbiddenError();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ActivityValidationError();
  const { projectId, title, detail, createTask } = input as Record<string, unknown>;
  if (!validRecordId(projectId) || typeof title !== 'string' || typeof detail !== 'string'
    || !title.trim() || !detail.trim() || title.length > 120 || detail.length > 1200
    || suspiciousCredential(title) || suspiciousCredential(detail)
    || (createTask!==undefined && typeof createTask!=='boolean')) throw new ActivityValidationError();
  return transaction(async db => {
    const workspace=await lockWorkspace(db,account.workspaceId);
    if (!workspace) throw new ForbiddenError();
    await projectPolicy(db, account);
    const project=await storedRecord(db,account.workspaceId,'projects',projectId);
    if (!project || (createTask && JSON.parse(project.payload).status==='archived')) throw new ActivityValidationError();
    const hourly = new Date(Date.now() - 3600_000).toISOString();
    const recent = await db.one<{n: number}>(`SELECT COUNT(*) AS n FROM audit_events
      WHERE workspace_id=? AND actor_id=? AND kind='manual' AND created_at>=?`, account.workspaceId, account.id, hourly);
    if ((recent?.n ?? 0) >= 30) throw new ActivityRateLimitError();
    const id = randomUUID();
    await db.run(`INSERT INTO audit_events(id,workspace_id,actor_id,kind,record_id,action,title,project_id,created_at,actor_snapshot)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, id, account.workspaceId, account.id, 'manual', projectId, detail.trim(), title.trim(),
    projectId, new Date().toISOString(), account.displayName);
    if (createTask) {
      const task=parseRecord('tasks',{
        id:'task-'+randomUUID(),projectId,title:title.trim(),description:detail.trim(),
        status:'todo',priority:'medium',owner:'',due:today(),checklist:[],comments:[],dependencies:[],
      });
      await persistChanges(db,account,workspace.version+1,[{kind:'tasks',id:task.id,record:task}]);
    }
    return id;
  });
}
