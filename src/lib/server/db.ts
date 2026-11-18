import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, basename, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { DemoData, ActivityEvent } from '../types';
import { emptyData } from '../empty-data';
import {redactStoredValue,redactCredentials} from './credential-guard';

const collections = ['projects','tasks','resources','secrets','reminders','incidents','expenses','charges','contracts','revenues','docs'] as const;
type Collection = typeof collections[number];
let database: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (database) return database;
  const path = resolve(process.env.PROJECTOS_DB_PATH || './local-data/projectos.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // A misconfigured DB must never be served as a static asset or written through a symlink.
  const parent=realpathSync(dirname(path));
  const writablePath=resolve(parent,basename(path));
  for(const forbidden of ['public','.next','.git','node_modules']){
    const root=resolve(process.cwd(),forbidden);
    const real=existsSync(root)?realpathSync(root):root;
    if(writablePath===real||writablePath.startsWith(real+sep))throw new Error('Unsafe database location');
  }
  try{if(lstatSync(path).isSymbolicLink())throw new Error('Symlink database path not permitted');}
  catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
  const db = new DatabaseSync(path, { timeout: 5000 });
  try { chmodSync(path, 0o600); } catch { /* platform may not implement POSIX mode */ }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL,
      failed_logins INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workspaces(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships(
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
      PRIMARY KEY(user_id, workspace_id)
    );
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS records(
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT,
      payload TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,kind,id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_project ON records(workspace_id,project_id);
    CREATE TABLE IF NOT EXISTS audit_events(
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL, record_id TEXT NOT NULL, action TEXT NOT NULL,
      title TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ws_date ON audit_events(workspace_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS document_versions(
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL, revision INTEGER NOT NULL,
      payload TEXT NOT NULL, saved_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,document_id,revision)
    );
    CREATE TABLE IF NOT EXISTS notification_outbox(
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      reminder_id TEXT NOT NULL, scheduled_for TEXT NOT NULL, channel TEXT NOT NULL,
      state TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT,
      UNIQUE(workspace_id, reminder_id, scheduled_for, channel)
    );`);
  // Additive migration: enforce an inactivity timeout on all sessions without deleting data.
  const sessionColumns=db.prepare('PRAGMA table_info(sessions)').all() as {name:string}[];
  if(!sessionColumns.some(column=>column.name==='last_seen_at')){
    db.exec('ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0');
    db.exec('UPDATE sessions SET last_seen_at=created_at WHERE last_seen_at=0');
  }
  // Additive migration: retain immutable actor label from the moment the action occurred.
  const columns = db.prepare('PRAGMA table_info(audit_events)').all() as {name:string}[];
  if(!columns.some(c=>c.name==='actor_snapshot'))db.exec("ALTER TABLE audit_events ADD COLUMN actor_snapshot TEXT NOT NULL DEFAULT ''");
  database = db;
  return db;
}

export function transaction<T>(execute: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try { const result = execute(db); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function userCount(): number {
  return Number((getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n);
}

export interface Account { id:string; email:string; displayName:string; workspaceId:string; role:'owner'|'editor'|'viewer' }
export function accountByUser(userId: string): Account | null {
  const row = getDb().prepare(`SELECT u.id,u.email,u.display_name AS displayName,m.workspace_id AS workspaceId,m.role
    FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=? LIMIT 1`).get(userId);
  return (row as Account | undefined) ?? null;
}

export function loadState(account: Account): { data:DemoData; version:number } {
  return readState(account, account.role==='owner');
}

// Internal write validation must retain records hidden from the editor's read projection.
export function loadStateForRecordMutation(account: Account): { data:DemoData; version:number } {
  if(account.role==='viewer')throw new ForbiddenError();
  return readState(account,true);
}

function readState(account:Account,includeVaultMetadata:boolean): { data:DemoData; version:number } {
  const db = getDb();
  const ws = db.prepare('SELECT version,name FROM workspaces WHERE id=?').get(account.workspaceId) as {version:number;name:string}|undefined;
  if (!ws) throw new Error('Workspace not found');
  const data = structuredClone(emptyData);
  const rows = db.prepare('SELECT kind,payload FROM records WHERE workspace_id=? AND (? OR kind<>\'secrets\')').all(account.workspaceId,Number(includeVaultMetadata)) as {kind:string;payload:string}[];
  for (const row of rows) {
    if (row.kind === 'preferences') {
      data.preferences = { ...data.preferences, ...JSON.parse(row.payload) };
    } else if (collections.includes(row.kind as Collection)) {
      // Stored records are written only after server-side canonical validation.
      (data as unknown as Record<string,unknown[]>)[row.kind].push(redactStoredValue(JSON.parse(row.payload)));
    }
  }
  data.preferences.workspace = ws.name;
  // Display the signed-in member's identity, not the owner's name stored in workspace preferences.
  // Non-owner roles cannot submit preference changes to the server.
  if(account.role!=='owner'||!rows.some(row=>row.kind==='preferences'))data.preferences.displayName=account.displayName;
  const members = db.prepare(`SELECT u.id,u.display_name AS name,u.email,m.role FROM memberships m
    JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?
    ORDER BY CASE WHEN u.id=? THEN 0 ELSE 1 END, u.email`).all(account.workspaceId,account.id) as Array<{id:string;name:string;email:string;role:string}>;
  data.users=members.map(m=>({id:m.id,name:m.name,email:m.email,
    role:m.role==='owner'?'Owner':m.role==='editor'?'Developer':'Viewer',projectId:'',state:'active'}));
  const events = db.prepare('SELECT a.id, a.title, a.project_id AS projectId, a.kind, a.action, a.created_at AS date, a.actor_snapshot AS actorSnapshot, u.display_name AS fallbackActor FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE a.workspace_id=? AND (? OR a.kind<>\'secrets\') ORDER BY a.created_at DESC LIMIT 500').all(account.workspaceId,Number(account.role==='owner')) as (Pick<ActivityEvent,'id'|'title'|'projectId'|'date'> & {kind:string;action:string;actorSnapshot:string;fallbackActor:string|null})[];
  const eventSources:Record<string,string>={projects:'پروژه‌ها',tasks:'وظایف',resources:'زیرساخت',docs:'مستندات',reminders:'تقویم',incidents:'هشدارها',secrets:'خزانه',expenses:'مالی',charges:'اشتراک‌ها',contracts:'قراردادها',revenues:'درآمد'};
  data.events = events.map(event => ({ id:event.id, title:redactCredentials(event.title), projectId:event.projectId, date:event.date, actor:redactCredentials(event.actorSnapshot||event.fallbackActor||'کاربر حذف‌شده'), source:eventSources[event.kind]??event.kind, detail:event.action==='create'?'ثبت رکورد جدید':event.action==='update'?'به‌روزرسانی رکورد':event.action==='delete'?'حذف رکورد':event.action }));
  return {data,version:ws.version};
}

type CanonicalState = Pick<DemoData, Collection | 'preferences'>;
export class VersionConflictError extends Error { constructor() { super('The workspace has changed. Reload to avoid overwriting another edit.'); } }
export class ForbiddenError extends Error { constructor() { super('Insufficient workspace permission'); } }
export function saveState(account:Account, expectedVersion:number, next:CanonicalState, controlledRecordEdit=false):number {
  // Editor grants are only permitted from the record adapter, after exact-kind authorization.
  if(account.role!=='owner' && !(account.role==='editor' && controlledRecordEdit))throw new ForbiddenError();
  return transaction(db => {
    const workspace = db.prepare('SELECT version FROM workspaces WHERE id=?').get(account.workspaceId) as {version:number}|undefined;
    if (!workspace) throw new ForbiddenError();
    if (workspace.version !== expectedVersion) throw new VersionConflictError();
    const old = db.prepare('SELECT kind,id,project_id,payload FROM records WHERE workspace_id=? AND kind<>\'preferences\'').all(account.workspaceId) as {kind:string;id:string;project_id:string;payload:string}[];
    const oldMap = new Map(old.map(r => [`${r.kind}:${r.id}`,r]));
    const changes:{kind:string;id:string;action:string;title:string;projectId:string}[]=[];
    const clock = new Date().toISOString();
    for (const kind of collections) {
      const newIds = new Set(next[kind].map(x=>x.id));
      for (const record of old.filter(r => r.kind===kind)) {
        if (!newIds.has(record.id)) changes.push({kind,id:record.id,action:'delete',title:`حذف ${kind}: ${record.id}`,projectId:record.project_id||''});
      }
      for (const record of next[kind]) {
        const before=oldMap.get(`${kind}:${record.id}`);
        // Compare with the read projection so an unrelated edit does not persist masking.
        // Explicit cleanup of existing credentials goes through the audited offline tool.
        if (!before || !isDeepStrictEqual(redactStoredValue(JSON.parse(before.payload)),record))
          changes.push({kind,id:record.id,action:before?'update':'create',title:('title' in record && typeof record.title === 'string' ? record.title : 'name' in record && typeof record.name === 'string' ? record.name : record.id),projectId:'projectId' in record && typeof record.projectId === 'string' ? record.projectId : kind==='projects'?record.id:''});
      }
    }
    if (changes.length > 100) throw new Error('Too many changes in a single request');
    // The reminder worker owns auto-* incident identity and metadata. Users may only
    // acknowledge/snooze an existing alert, never fabricate or alter its provenance.
    for(const change of changes.filter(c=>c.kind==='incidents'&&c.id.startsWith('auto-'))){
      if(change.action!=='update')throw new ForbiddenError();
      const previous=oldMap.get(`incidents:${change.id}`);
      const current=next.incidents.find(record=>record.id===change.id);
      if(!previous||!current)throw new ForbiddenError();
      const omitMutable=(value:object)=>Object.fromEntries(Object.entries(value)
        .filter(([field])=>field!=='state'&&field!=='snoozedUntil'));
      if(JSON.stringify(omitMutable(JSON.parse(previous.payload)))!==JSON.stringify(omitMutable(current)))throw new ForbiddenError();
    }
    const insertDocVersion=db.prepare('INSERT OR IGNORE INTO document_versions(workspace_id,document_id,revision,payload,saved_at) VALUES(?,?,?,?,?)');
    for(const change of changes){
      if(change.kind!=='docs'||change.action==='delete')continue;
      const doc=next.docs.find(record=>record.id===change.id)!;
      const oldDoc=oldMap.get(`docs:${doc.id}`);
      const before=oldDoc?JSON.parse(oldDoc.payload):null;
      if(before && doc.revision<before.revision)throw new Error('Document revision cannot decrease');
      if(before && doc.revision===before.revision)throw new Error('Document revision must advance on edits');
      insertDocVersion.run(account.workspaceId,doc.id,doc.revision,JSON.stringify(doc),clock);
    }
    // Incremental persistence: preserve unchanged records and avoid wiping worker-created incidents.
    const upsert=db.prepare(`INSERT INTO records(workspace_id,kind,id,project_id,payload,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET
      project_id=excluded.project_id,payload=excluded.payload,updated_at=excluded.updated_at`);
    const remove=db.prepare('DELETE FROM records WHERE workspace_id=? AND kind=? AND id=?');
    for(const c of changes){
      if(c.action==='delete')remove.run(account.workspaceId,c.kind,c.id);
      else{
        const record=next[c.kind as Collection].find(r=>r.id===c.id);
        if(!record)throw new Error('Missing changed record');
        upsert.run(account.workspaceId,c.kind,c.id,'projectId' in record ? record.projectId : c.kind==='projects'?record.id:null,JSON.stringify(record),clock);
      }
    }
    if(account.role==='owner')upsert.run(account.workspaceId,'preferences','singleton',null,JSON.stringify(next.preferences),clock);
    const addAudit = db.prepare('INSERT INTO audit_events(id,workspace_id,actor_id,kind,record_id,action,title,project_id,created_at,actor_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?)');
    for (const c of changes) addAudit.run(randomUUID(),account.workspaceId,account.id,c.kind,c.id,c.action,c.title,c.projectId,clock,account.displayName);
    if(account.role==='owner'){
      db.prepare('UPDATE workspaces SET version=version+1,name=? WHERE id=?').run(next.preferences.workspace,account.workspaceId);
      db.prepare('UPDATE users SET display_name=? WHERE id=?').run(next.preferences.displayName,account.id);
    }else db.prepare('UPDATE workspaces SET version=version+1 WHERE id=?').run(account.workspaceId);
    return expectedVersion+1;
  });
}
