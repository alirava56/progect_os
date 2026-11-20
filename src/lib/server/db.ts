import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { getDb, lockWorkspace, readTransaction, sql, transaction, type SqlExecutor } from '../../../scripts/database.mjs';
import { emptyData } from '../empty-data';
import { isRecordKind, recordKinds, type RecordKind, type WorkspaceRecord } from '../record-contract';
import type { ActivityEvent, DemoData, Preferences, Resource } from '../types';
import { redactStoredValue, redactCredentials } from './credential-guard';
import { ValidationError, type CanonicalState } from './validation';

export { getDb, lockWorkspace, readTransaction, sql, transaction, type SqlExecutor };
export interface Account {
  id: string;
  email: string;
  displayName: string;
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer';
}
export interface ProjectPolicy {
  projectIds: ReadonlySet<string> | null;
}
export interface RecordRow {
  kind: RecordKind | 'preferences';
  id: string;
  project_id: string | null;
  payload: string;
  record_version: number;
}
export interface PreparedChange {
  kind: RecordKind;
  id: string;
  previous?: RecordRow;
  record?: WorkspaceRecord;
}
export class VersionConflictError extends Error {
  constructor() { super('The record has changed. Refresh and retry.'); }
}
export class ForbiddenError extends Error {
  constructor() { super('Insufficient workspace permission'); }
}

export async function userCount() {
  return (await sql.one<{n: number}>('SELECT COUNT(*) AS n FROM users'))?.n ?? 0;
}

export async function accountByUser(userId: string, db = sql): Promise<Account | null> {
  return await db.one<Account>(`SELECT u.id,u.email,u.display_name AS "displayName",
    m.workspace_id AS "workspaceId",m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=?`,
  userId) ?? null;
}

export async function projectPolicy(db: SqlExecutor, account: Account): Promise<ProjectPolicy> {
  const member = await db.one<{role: Account['role']; project_ids: string | null}>(
    'SELECT role,project_ids FROM memberships WHERE workspace_id=? AND user_id=?',
    account.workspaceId, account.id,
  );
  if (!member || member.role !== account.role) throw new ForbiddenError();
  if (member.role === 'owner' || member.project_ids === null) return { projectIds: null };
  const grants: unknown = JSON.parse(member.project_ids);
  if (!Array.isArray(grants) || grants.some(id => typeof id !== 'string')) throw new ForbiddenError();
  return { projectIds: new Set<string>(grants) };
}

export function canSeeProject(policy: ProjectPolicy, projectId: string | null | undefined) {
  return policy.projectIds === null || (typeof projectId === 'string' && policy.projectIds.has(projectId));
}

export function storedRecord(db: SqlExecutor, workspaceId: string, kind: RecordRow['kind'], id: string) {
  return db.one<RecordRow>(
    'SELECT kind,id,project_id,payload,record_version FROM records WHERE workspace_id=? AND kind=? AND id=?',
    workspaceId, kind, id,
  );
}

function redactRecord(row: RecordRow): WorkspaceRecord {
  return redactStoredValue(JSON.parse(row.payload)) as WorkspaceRecord;
}

async function projectRecord(
  db: SqlExecutor, account: Account, policy: ProjectPolicy, row: RecordRow,
): Promise<WorkspaceRecord | undefined> {
  if (!isRecordKind(row.kind) || (row.kind === 'secrets' && account.role !== 'owner')) return;
  const record = redactRecord(row);
  if (row.kind === 'incidents' && account.role !== 'owner'
    && (record as DemoData['incidents'][number]).source === 'زمان‌بند داخلی · چرخش اعتبارنامه') return;
  if (policy.projectIds === null) return record;
  if (row.kind === 'resources') {
    const resource = record as DemoData['resources'][number];
    const accessibleProjects = [resource.projectId, ...(resource.linkedProjectIds ?? [])]
      .filter(id => canSeeProject(policy, id));
    if (!accessibleProjects.length) return;
    const [projectId, ...linkedProjectIds] = accessibleProjects;
    const parent = resource.parentId
      ? await storedRecord(db, account.workspaceId, 'resources', resource.parentId)
      : undefined;
    const visibleParent = parent && (canSeeProject(policy, parent.project_id)
      || ((JSON.parse(parent.payload).linkedProjectIds ?? []) as string[]).some(id => canSeeProject(policy, id)));
    return { ...resource, projectId, linkedProjectIds, parentId: visibleParent ? resource.parentId : undefined };
  }
  if (!canSeeProject(policy, row.project_id)) return;
  if (row.kind === 'tasks') {
    const task = record as DemoData['tasks'][number];
    const dependencies = await Promise.all(task.dependencies.map(async id => {
      const dependency = await storedRecord(db, account.workspaceId, 'tasks', id);
      return dependency && canSeeProject(policy, dependency.project_id) ? id : undefined;
    }));
    return { ...task, dependencies: dependencies.filter(id => id !== undefined) };
  }
  if (row.kind === 'charges') {
    const charge = record as DemoData['charges'][number];
    const resource = charge.linkedResourceId
      ? await storedRecord(db, account.workspaceId, 'resources', charge.linkedResourceId)
      : undefined;
    if (resource && await projectRecord(db, account, policy, resource)) return charge;
    return { ...charge, linkedResourceId: undefined };
  }
  return record;
}

export async function loadRecord(account: Account, kind: RecordKind, id: string) {
  return readTransaction(async db => {
    const policy = await projectPolicy(db, account);
    const row = await storedRecord(db, account.workspaceId, kind, id);
    if (!row) return;
    const record = await projectRecord(db, account, policy, row);
    if (!record) return;
    const workspace = await db.one<{version: number}>('SELECT version FROM workspaces WHERE id=?', account.workspaceId);
    if (!workspace) throw new ForbiddenError();
    return { record, version: workspace.version, recordVersion: row.record_version };
  });
}

const eventSources: Record<string, string> = {
  projects: 'پروژه‌ها', tasks: 'وظایف', resources: 'زیرساخت', docs: 'مستندات',
  reminders: 'تقویم', incidents: 'هشدارها', secrets: 'خزانه', expenses: 'مالی',
  charges: 'اشتراک‌ها', contracts: 'قراردادها', revenues: 'درآمد',
};
type EventRow = Pick<ActivityEvent, 'id' | 'title' | 'projectId' | 'date'> & {
  kind: string; action: string; actorSnapshot: string; fallbackActor: string | null;
};
type Member = {id: string; name: string; email: string; role: Account['role']; project_ids: string | null};

export function loadState(account: Account): Promise<{data: DemoData; version: number}> {
  return readTransaction(db => readState(db, account));
}
async function readState(db: SqlExecutor, account: Account) {
  const policy = await projectPolicy(db, account);
  const workspace = await db.one<{version: number; name: string}>(
    'SELECT version,name FROM workspaces WHERE id=?', account.workspaceId,
  );
  if (!workspace) throw new ForbiddenError();
  const data = structuredClone(emptyData);
  const rows = await db.all<RecordRow>(`SELECT kind,id,project_id,payload,record_version FROM records
    WHERE workspace_id=? AND (?=1 OR kind<>'secrets') ORDER BY updated_at,id`,
  account.workspaceId, Number(account.role === 'owner'));
  const prefs = rows.find(row => row.kind === 'preferences');
  if (prefs) data.preferences = { ...data.preferences, ...redactStoredValue(JSON.parse(prefs.payload)) as object };
  data.preferences.workspace = redactCredentials(workspace.name);
  if (account.role !== 'owner' || !prefs) data.preferences.displayName = redactCredentials(account.displayName);
  for (const row of rows) {
    if (!isRecordKind(row.kind)) continue;
    const record = await projectRecord(db, account, policy, row);
    if (record) (data[row.kind] as WorkspaceRecord[]).push(record);
  }
  const members = await db.all<Member>(`SELECT u.id,u.display_name AS name,u.email,m.role,m.project_ids FROM memberships m
    JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND (?=1 OR u.id=?)
    ORDER BY CASE WHEN u.id=? THEN 0 ELSE 1 END,u.email`,
  account.workspaceId, Number(policy.projectIds === null), account.id, account.id);
  data.users = members.map(m => ({
    id: m.id, name: redactCredentials(m.name), email: redactCredentials(m.email),
    role: m.role === 'owner' ? 'Owner' : m.role === 'editor' ? 'Developer' : 'Viewer',
    projectId: '', state: 'active',
    ...(account.role === 'owner' ? { projectIds: m.project_ids === null ? null : JSON.parse(m.project_ids) as string[] } : {}),
  }));
  const grants = policy.projectIds ? [...policy.projectIds] : null;
  const projectCondition = grants
    ? grants.length ? ` AND a.project_id IN (${grants.map(() => '?').join(',')})` : ' AND 1=0'
    : '';
  const events = await db.all<EventRow>(`SELECT a.id,a.title,a.project_id AS "projectId",a.kind,a.action,
    a.created_at AS date,a.actor_snapshot AS "actorSnapshot",u.display_name AS "fallbackActor"
    FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id
    WHERE a.workspace_id=? AND (?=1 OR a.kind<>'secrets')${projectCondition}
    ORDER BY a.created_at DESC,a.id DESC LIMIT 500`, account.workspaceId, Number(account.role === 'owner'), ...(grants ?? []));
  data.events = events.map(event => ({
    id: event.id, title: redactCredentials(event.title), projectId: event.projectId, date: event.date,
    actor: redactCredentials(event.actorSnapshot || event.fallbackActor || 'کاربر حذف‌شده'),
    source: eventSources[event.kind] ?? event.kind,
    detail: {create: 'ثبت رکورد جدید', update: 'به‌روزرسانی رکورد', delete: 'حذف رکورد'}[event.action] ?? redactCredentials(event.action),
  }));
  return { data, version: workspace.version };
}

export function projectOf(kind: RecordKind, record: WorkspaceRecord) {
  return kind === 'projects' ? record.id : 'projectId' in record ? record.projectId : null;
}

async function writeRow(db: SqlExecutor, workspaceId: string, row: RecordRow, timestamp: string) {
  await db.run(`INSERT INTO records(workspace_id,kind,id,project_id,payload,updated_at,record_version) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(workspace_id,kind,id) DO UPDATE SET project_id=excluded.project_id,payload=excluded.payload,
      updated_at=excluded.updated_at,record_version=excluded.record_version`,
  workspaceId, row.kind, row.id, row.project_id, row.payload, timestamp, row.record_version);
}

function automationFields(record: object) {
  return Object.fromEntries(Object.entries(record).filter(([field]) => field !== 'state' && field !== 'snoozedUntil'));
}

function resourceLink(kind: RecordKind, record?: WorkspaceRecord) {
  if (kind === 'charges') {
    const charge = record as DemoData['charges'][number] | undefined;
    if (charge?.linkedResourceId) return {id:charge.linkedResourceId, projectId:charge.projectId};
  }
  if (kind === 'secrets') {
    const reference = record as DemoData['secrets'][number] | undefined;
    if (reference?.resourceId) return {id:reference.resourceId, projectId:reference.projectId};
  }
}

export async function persistChanges(
  db: SqlExecutor, account: Account, version: number, changes: PreparedChange[], preferences?: Preferences,
) {
  const now = new Date().toISOString();
  const { workspaceId } = account;
  if (changes.length > 100) throw new ValidationError('Too many record changes');
  const resourceChanges = new Map(changes.filter(change => change.kind === 'resources').map(change => [change.id, change]));
  for (const change of changes) {
    const { kind, id, record, previous } = change;
    const before = previous ? JSON.parse(previous.payload) as WorkspaceRecord : undefined;
    const projectId = record ? projectOf(kind, record) : previous?.project_id ?? null;
    if (kind === 'incidents' && (id.startsWith('auto-') || id.startsWith('monitor-'))) {
      if (!before || !record || !isDeepStrictEqual(automationFields(before), automationFields(record))) {
        throw new ForbiddenError();
      }
      const incident = record as DemoData['incidents'][number];
      if (incident.source === 'زمان‌بند داخلی · چرخش اعتبارنامه' && account.role !== 'owner') throw new ForbiddenError();
      if (incident.state !== 'open') {
        await db.run(`UPDATE notification_outbox SET state='cancelled' WHERE workspace_id=?
          AND (id=? OR id=? OR id LIKE ? OR id LIKE ?) AND state IN ('pending','retrying','sending')`,
        workspaceId, 'tg-' + id, 'email-' + id, 'tg-' + id + '-%', 'email-' + id + '-%');
      }
    }
    if (record && before && !isDeepStrictEqual(before, redactStoredValue(before))) {
      // A read projection is insufficient to overwrite a quarantined legacy record.
      throw new ValidationError('Legacy record requires offline credential remediation');
    }
    if (kind === 'secrets' && record) {
      const proposed = record as DemoData['secrets'][number];
      const current = before as DemoData['secrets'][number] | undefined;
      if (proposed.lastCheckedAt !== current?.lastCheckedAt
        || (current?.lastCheckedAt && proposed.externalRef !== current.externalRef)) {
        throw new ForbiddenError();
      }
    }
    const link = resourceLink(kind, record);
    if (link) {
      const prior = resourceLink(kind, before);
      if (link.id !== prior?.id || link.projectId !== prior?.projectId) {
        const pending = resourceChanges.get(link.id);
        const stored = pending ? undefined : await storedRecord(db, workspaceId, 'resources', link.id);
        const resource = (pending?.record as Resource | undefined) ?? (stored ? JSON.parse(stored.payload) as Resource : undefined);
        if (!resource || (resource.projectId !== link.projectId && !resource.linkedProjectIds?.includes(link.projectId))) {
          throw new ValidationError('Linked resource must belong to or be shared with the record project');
        }
      }
    }
    if (record && !before && (kind === 'projects' || kind === 'docs')) {
      const deleted = await db.one(`SELECT id FROM audit_events WHERE workspace_id=? AND kind=? AND record_id=?
        AND action='delete' LIMIT 1`, workspaceId, kind, id);
      if (deleted) throw new VersionConflictError();
    }
    if (record && kind === 'docs') {
      const doc = record as DemoData['docs'][number];
      const old = before as DemoData['docs'][number] | undefined;
      if (old && doc.revision <= old.revision) throw new ValidationError('Document revision must advance on edits');
      const added = await db.run(`INSERT INTO document_versions(workspace_id,document_id,revision,payload,saved_at) VALUES(?,?,?,?,?)
        ON CONFLICT(workspace_id,document_id,revision) DO NOTHING`,
      workspaceId, id, doc.revision, JSON.stringify(doc), now);
      if (!added) throw new VersionConflictError();
    }
    if (record) {
      await writeRow(db, workspaceId, { kind, id, project_id: projectId, payload: JSON.stringify(record), record_version: version }, now);
      await db.run('DELETE FROM record_tombstones WHERE workspace_id=? AND kind=? AND id=?', workspaceId, kind, id);
    } else {
      await db.run('DELETE FROM records WHERE workspace_id=? AND kind=? AND id=?', workspaceId, kind, id);
      await db.run(`INSERT INTO record_tombstones(workspace_id,kind,id,record_version) VALUES(?,?,?,?)
        ON CONFLICT(workspace_id,kind,id) DO UPDATE SET record_version=excluded.record_version`, workspaceId, kind, id, version);
    }
    const title = record && 'title' in record ? record.title : record && 'name' in record ? record.name : id;
    await db.run(`INSERT INTO audit_events(id,workspace_id,actor_id,kind,record_id,action,title,project_id,created_at,actor_snapshot)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, randomUUID(), workspaceId, account.id,
    kind === 'incidents' && ((record ?? before) as DemoData['incidents'][number] | undefined)?.source === 'زمان‌بند داخلی · چرخش اعتبارنامه'
      ? 'secrets' : kind, id,
    record ? previous ? 'update' : 'create' : 'delete', redactCredentials(title), projectId ?? '', now,
    redactCredentials(account.displayName));
  }
  if (preferences) {
    await writeRow(db, workspaceId, { kind: 'preferences', id: 'singleton', project_id: null,
      payload: JSON.stringify(preferences), record_version: version }, now);
    await db.run('UPDATE workspaces SET version=?,name=? WHERE id=?', version, preferences.workspace, workspaceId);
    await db.run('UPDATE users SET display_name=? WHERE id=?', preferences.displayName, account.id);
  } else {
    await db.run('UPDATE workspaces SET version=? WHERE id=?', version, workspaceId);
  }
}

export async function saveState(account: Account, expectedVersion: number, next: CanonicalState) {
  if (account.role !== 'owner') throw new ForbiddenError();
  return transaction(async db => {
    const workspace = await lockWorkspace(db, account.workspaceId);
    if (!workspace) throw new ForbiddenError();
    await projectPolicy(db, account);
    if (workspace.version !== expectedVersion) throw new VersionConflictError();
    const rows = await db.all<RecordRow>(
      "SELECT kind,id,project_id,payload,record_version FROM records WHERE workspace_id=? AND kind<>'preferences'",
      account.workspaceId,
    );
    const changes: PreparedChange[] = [];
    for (const kind of recordKinds) {
      const previous = new Map(rows.filter(row => row.kind === kind).map(row => [row.id, row]));
      for (const record of next[kind]) {
        const row = previous.get(record.id);
        previous.delete(record.id);
        if (!row || !isDeepStrictEqual(redactRecord(row), record)) {
          changes.push({ kind, id: record.id, previous: row, record });
        }
      }
      for (const row of previous.values()) changes.push({ kind, id: row.id, previous: row });
    }
    const version = expectedVersion + 1;
    await persistChanges(db, account, version, changes, next.preferences);
    return version;
  });
}
