/* eslint-disable @typescript-eslint/no-require-imports -- run the TypeScript services with Node's test runner */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const ts = require('typescript');
const { Client } = require('pg');

require.extensions['.ts'] = (module, file) => {
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
  }).outputText;
  module._compile(compiled, file);
};

const { closeDatabase, getPostgresPool, getDb } = require('./database.mjs');
const { setupOwner, authenticate, newSession, lookupSessionUserId } = require('../src/lib/server/auth.ts');
const { accountByUser, loadState, sql } = require('../src/lib/server/db.ts');
const { commitRecordChanges } = require('../src/lib/server/record-service.ts');
const { createInvitation, acceptInvitation } = require('../src/lib/server/invitations.ts');
const { beginMfa, confirmMfa, issueRecoveryCodes, totp } = require('../src/lib/server/mfa.ts');

function project(id) {
  return { id, name: id, subtitle: '', coverTitle: id, description: '', status: 'building', type: 'Website',
    progress: 0, next: '', art: 'navigation/projects' };
}
function create(kind, record) { return { kind, id: record.id, action: 'create', record }; }

test('SQLite to PostgreSQL preserves data and identity; transactional rollback, retries and encrypted restore', { timeout: 90_000 }, async () => {
  const url = new URL(process.env.PROJECTOS_TEST_POSTGRES_URL || 'file:/');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname)
    && url.pathname === '/postgres', 'A disposable, loopback PostgreSQL admin database is required');
  const suffix = randomBytes(6).toString('hex');
  const target = 'projectos_test_' + suffix;
  const restoreTarget = 'projectos_restore_' + suffix;
  const connectionFor = db => new URL('/' + db, url).href;
  const admin = new Client({ connectionString: url.href });
  const area = mkdtempSync(join(tmpdir(), 'projectos-pg-test-'));
  const sqlitePath = join(area, 'source.sqlite');
  const legacyBackup = join(area, 'source.posbak'), postgresBackup = join(area, 'postgres.posbak');
  process.env.PROJECTOS_DATABASE_URL = '';
  process.env.PROJECTOS_DB_PATH = sqlitePath;
  process.env.PROJECTOS_SETUP_TOKEN = 'synthetic-test-bootstrap-key-only';
  process.env.PROJECTOS_MFA_ENCRYPTION_KEY = '51'.repeat(32);
  process.env.PROJECTOS_BACKUP_PASSPHRASE = 'synthetic-test-archive-key-2026';
  const ownerEmail = 'postgres-owner@example.test', password = 'synthetic-password-for-testing';
  const run = (entry, ...args) => execFileSync(process.execPath, [join(__dirname, entry), ...args], {
    encoding: 'utf8', env: process.env, timeout: 30_000,
  }).trim();
  const created = [];
  await admin.connect();
  try {
    const uid = await setupOwner({setupToken: process.env.PROJECTOS_SETUP_TOKEN, email: ownerEmail, password,
      displayName: 'Test owner', workspace: 'Local test'});
    const owner = await accountByUser(uid);
    const { secret } = await beginMfa(uid, owner.email);
    assert.equal(await confirmMfa(uid, totp(secret)), true);
    assert.equal((await issueRecoveryCodes(uid)).length, 10);
    const archivedSession = await newSession(uid);
    await commitRecordChanges(owner, 0, [
      create('projects', project('alpha')),
      create('projects', project('beta')),
      create('docs', {id:'doc', projectId:'alpha', title:'آزمون', type:'Runbook', body:'Synthetic runbook', revision:1, updated:'2026-11-18'}),
      create('reminders', {id:'rem', projectId:'alpha', title:'Synthetic reminder', due:'2026-11-18', kind:'یادآوری'}),
      create('secrets', {id:'ref', projectId:'alpha', name:'Vault pointer', type:'SSH Key', vaultProvider:'1Password', externalRef:'https://start.1password.com/open/i?i=synthetic'}),
    ]);
    const inv = await createInvitation(owner, 'postgres-editor@example.test', 'editor', ['alpha']);
    const editorId = await acceptInvitation({token:inv.token,email:'postgres-editor@example.test',password,displayName:'Test editor'});
    getDb().prepare('INSERT INTO notification_outbox(id,workspace_id,reminder_id,scheduled_for,channel,state,created_at,delivered_at) VALUES(?,?,?,?,?,?,?,?)')
      .run('outbox-fixture',owner.workspaceId,'reminders:rem','2026-11-18','telegram','delivered',new Date().toISOString(),new Date().toISOString());
    const before = await loadState(owner);
    run('encrypted-backup.mjs', legacyBackup);
    await closeDatabase();
    const plan = JSON.parse(run('migrate-sqlite-postgres.mjs','--source',sqlitePath,'--dry-run'));
    assert.equal(plan.counts.records, 5);
    assert.equal(plan.counts.document_versions, 1);
    assert.equal(plan.counts.notification_outbox, 1);
    assert.equal(plan.counts.memberships, 2);

    for (const db of [target, restoreTarget]) {
      await admin.query('CREATE DATABASE "' + db + '"');
      created.push(db);
    }
    process.env.PROJECTOS_DATABASE_URL = connectionFor(target);
    process.env.PROJECTOS_RESTORE_URL = connectionFor(restoreTarget);
    assert.match(run('migrate-postgres.mjs'), /Applied 001_initial/);
    assert.doesNotMatch(run('migrate-postgres.mjs'), /Applied/);

    const { importSnapshot, manifest, openSnapshot } = await import('./sqlite-import.mjs');
    const source = openSnapshot(sqlitePath);
    try {
      await assert.rejects(importSnapshot(getPostgresPool(), source, manifest(source), () => {
        throw new Error('simulated pre-commit failure');
      }), /simulated pre-commit failure/);
      assert.equal((await sql.one('SELECT COUNT(*) AS n FROM users')).n, 0);
      assert.equal((await sql.one('SELECT COUNT(*) AS n FROM sqlite_imports')).n, 0);
    } finally { source.close(); }

    const imported = JSON.parse(run('migrate-sqlite-postgres.mjs','--source',sqlitePath,'--apply','--backup',legacyBackup));
    assert.equal(imported.status, 'imported');
    assert.equal(imported.digest, plan.digest);
    assert.deepEqual(imported.counts, plan.counts);
    assert.equal(JSON.parse(run('migrate-sqlite-postgres.mjs','--source',sqlitePath,'--apply','--backup',legacyBackup)).status, 'already_imported');
    assert.equal(JSON.parse(run('migrate-sqlite-postgres.mjs','--source',sqlitePath,'--dry-run')).digest, plan.digest);

    assert.equal(await authenticate(ownerEmail, password), uid);
    assert.equal(await lookupSessionUserId(archivedSession), uid);
    assert.deepEqual((await loadState(owner)).data.docs, before.data.docs);
    assert.deepEqual((await loadState(await accountByUser(editorId))).data.projects.map(project => project.id), ['alpha']);
    const edit = (id, next) => ({ kind:'projects', id, action:'replace', record:{...project(id), next} });
    const [one, two] = await Promise.all([
      commitRecordChanges(owner, before.version, [edit('alpha', 'independent A')]),
      commitRecordChanges(owner, before.version, [edit('beta', 'independent B')]),
    ]);
    assert.notEqual(one, two);
    await assert.rejects(commitRecordChanges(owner, before.version, [edit('alpha', 'stale')]), /changed/);
    const record = await sql.one("SELECT payload FROM records WHERE kind='projects' AND id='alpha'");
    assert.equal(JSON.parse(record.payload).next, 'independent A');

    const report = JSON.parse(run('postgres-backup.mjs','backup',postgresBackup));
    assert.equal(report.encrypted, true);
    const restored = JSON.parse(run('postgres-backup.mjs','restore',postgresBackup));
    assert.equal(Number(restored.workspaces), 1);
    assert.equal(Number(restored.document_versions), 1);
    assert.equal(Number(restored.records), 5);
    assert.throws(() => run('postgres-backup.mjs','restore',postgresBackup));
    await closeDatabase();
    process.env.PROJECTOS_DATABASE_URL = connectionFor(restoreTarget);
    assert.equal(await authenticate(ownerEmail, password), uid);
    const current = await loadState(owner);
    assert.equal(current.data.projects.find(item => item.id === 'beta').next, 'independent B');
    assert.equal((await sql.one('SELECT state FROM notification_outbox WHERE id=?','outbox-fixture')).state, 'delivered');
  } finally {
    await closeDatabase();
    for (const db of created.reverse()) await admin.query('DROP DATABASE "' + db + '"');
    await admin.end();
    rmSync(area, { recursive:true, force:true, maxRetries:5 });
  }
});