/* eslint-disable @typescript-eslint/no-require-imports -- run the TypeScript services with Node's test runner */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Readable } = require('node:stream');
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
      create('resources', {id:'vps', name:'Synthetic VPS', projectId:'alpha', linkedProjectIds:[], type:'server',
        address:'203.0.113.10', environment:'Development', status:'registered', provider:'Fixture host', tags:[],
        expires:'2031-03-04',noticeDays:2}),
      create('secrets', {id:'ref', projectId:'alpha', resourceId:'vps', name:'Vault pointer', type:'SSH Key',
        vaultProvider:'1Password', externalRef:'https://start.1password.com/open/i?i=synthetic'}),
    ]);
    const inv = await createInvitation(owner, 'postgres-editor@example.test', 'editor', ['alpha']);
    const editorId = await acceptInvitation({token:inv.token,email:'postgres-editor@example.test',password,displayName:'Test editor'});
    getDb().prepare('INSERT INTO notification_outbox(id,workspace_id,reminder_id,scheduled_for,channel,state,created_at,delivered_at) VALUES(?,?,?,?,?,?,?,?)')
      .run('outbox-fixture',owner.workspaceId,'reminders:rem','2026-11-18','telegram','delivered',new Date().toISOString(),new Date().toISOString());
    const observation=getDb().prepare(`INSERT INTO machine_observations(workspace_id,resource_id,checked_at,cpu_percent,used_bytes,total_bytes,
      disk_used_bytes,disk_total_bytes) VALUES(?,?,?,?,?,?,?,?)`);
    observation.run(owner.workspaceId,'vps','2026-11-18T10:00:00.000Z',25,512,1024,null,null);
    observation.run(owner.workspaceId,'vps','2026-11-18T11:00:00.000Z',35,512,1024,6144,8192);
    const before = await loadState(owner);
    run('encrypted-backup.mjs', legacyBackup);
    await closeDatabase();
    const plan = JSON.parse(run('migrate-sqlite-postgres.mjs','--source',sqlitePath,'--dry-run'));
    assert.equal(plan.counts.records, 6);
    assert.equal(plan.counts.document_versions, 1);
    assert.equal(plan.counts.notification_outbox, 1);
    assert.equal(plan.counts.memberships, 2);
    assert.equal(plan.counts.machine_observations, 2);

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
    assert.deepEqual((await loadState(owner)).data.secrets, before.data.secrets);
    await assert.rejects(commitRecordChanges(owner, before.version, [{kind:'resources', id:'vps', action:'delete'}]), /Vault references/);
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
    const invalidBackup = join(area, 'invalid.posbak');
    const { decryptArchive, encryptArchive, postgresHeader } = await import('./encrypted-archive.mjs');
    await encryptArchive(Readable.from([Buffer.from('Synthetic text in place of a PostgreSQL archive')]),
      invalidBackup, process.env.PROJECTOS_BACKUP_PASSPHRASE, postgresHeader);
    assert.throws(() => run('postgres-backup.mjs','restore',invalidBackup), /PostgreSQL restore catalog failed/);
    assert.throws(() => run('postgres-backup.mjs','verify',invalidBackup), /PostgreSQL restore catalog failed/);
    const catalogFixture=join(area,'verify-catalog.dump');
    await decryptArchive(postgresBackup,catalogFixture,process.env.PROJECTOS_BACKUP_PASSPHRASE,postgresHeader);
    const pgRestore=process.env.PROJECTOS_PG_BIN ? join(process.env.PROJECTOS_PG_BIN,'pg_restore') : 'pg_restore';
    // This process sees an archive seeded entirely with synthetic data. Keep production CLI diagnostics fixed and sanitized.
    const catalog=execFileSync(pgRestore,['--list',catalogFixture],{encoding:'utf8',timeout:15_000});
    assert.match(catalog,/TABLE public records\b/);
    assert.match(catalog,/TABLE public machine_observations\b/);
    const truncatedBackup=join(area,'truncated.posbak');
    const archive=readFileSync(catalogFixture);
    await encryptArchive(Readable.from([archive.subarray(0,archive.length-512)]),
      truncatedBackup,process.env.PROJECTOS_BACKUP_PASSPHRASE,postgresHeader);
    assert.throws(() => run('postgres-backup.mjs','verify',truncatedBackup),/PostgreSQL restore .*failed/);
    const verifyOffline=(filename)=>JSON.parse(execFileSync(process.execPath,[join(__dirname,'postgres-backup.mjs'),'verify',filename],{
      encoding:'utf8',env:{...process.env,PROJECTOS_DATABASE_URL:'disabled',PROJECTOS_RESTORE_URL:'disabled'},timeout:30_000,
    }));
    assert.deepEqual(verifyOffline(postgresBackup),{
      ok:true,format:'PROJECTOS-POSTGRES-v1',encrypted:true,catalogVerified:true,dataDecoded:true,
    });
    const restored = JSON.parse(run('postgres-backup.mjs','restore',postgresBackup));
    assert.equal(Number(restored.workspaces), 1);
    assert.equal(Number(restored.document_versions), 1);
    assert.equal(Number(restored.records), 6);
    assert.throws(() => run('postgres-backup.mjs','restore',postgresBackup));
    await closeDatabase();
    process.env.PROJECTOS_DATABASE_URL = connectionFor(restoreTarget);
    assert.equal(await authenticate(ownerEmail, password), uid);
    const current = await loadState(owner);
    assert.equal(current.data.projects.find(item => item.id === 'beta').next, 'independent B');
    assert.equal(current.data.secrets.find(item => item.id === 'ref').resourceId, 'vps');
    assert.equal((await sql.one('SELECT state FROM notification_outbox WHERE id=?','outbox-fixture')).state, 'delivered');
    const disks=await sql.all('SELECT disk_used_bytes,disk_total_bytes FROM machine_observations WHERE workspace_id=? ORDER BY checked_at',owner.workspaceId);
    assert.deepEqual(disks,[{disk_used_bytes:null,disk_total_bytes:null},{disk_used_bytes:6144,disk_total_bytes:8192}]);
    const {reconcileReminders,reminderAlertId}=await import('./reminder-scheduler.mjs');
    const scan=clock=>reconcileReminders({clock:new Date(clock),channels:['email'],notificationWorkspace:owner.workspaceId});
    const vps=current.data.resources.find(item=>item.id==='vps');
    assert.equal(vps.noticeDays,2);
    await scan('2031-03-02T10:00:00Z');
    const old='email-'+reminderAlertId(owner.workspaceId,'تمدید',vps.id,vps.expires,'resources');
    assert.equal((await sql.one('SELECT state FROM notification_outbox WHERE id=?',old)).state,'pending');
    const moved={...vps,expires:'2031-03-05'};
    await commitRecordChanges(owner,(await loadState(owner)).version,[{kind:'resources',id:vps.id,action:'replace',record:moved}]);
    assert.equal((await sql.one('SELECT state FROM notification_outbox WHERE id=?',old)).state,'cancelled');
    await scan('2031-03-03T10:00:00Z');
    const next='email-'+reminderAlertId(owner.workspaceId,'تمدید',vps.id,moved.expires,'resources');
    assert.equal((await sql.one('SELECT state FROM notification_outbox WHERE id=?',next)).state,'pending');

    const invoice={id:'invoice',projectId:'alpha',reference:'FIX-01',title:'Fixture invoice',direction:'receivable',
      currency:'USD',amountUnit:'minor',amount:1250,issuedOn:'2031-03-01',dueOn:'2031-04-01',state:'open',
      installments:[{dueOn:'2031-03-15',amount:500},{dueOn:'2031-04-01',amount:750}]};
    const revision=await commitRecordChanges(owner,(await loadState(owner)).version,[create('invoices',invoice)]);
    const payment={id:'payment-one',projectId:'alpha',invoiceId:invoice.id,reference:'FIX-P۱',
      currency:'USD',amountUnit:'minor',amount:500,paidOn:'2031-03-10'};
    const results=await Promise.allSettled([
      commitRecordChanges(owner,revision,[create('payments',payment)]),
      commitRecordChanges(owner,revision,[create('payments',{...payment,id:'payment-duplicate',reference:'fix-p1'})]),
    ]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.match(results.find(result=>result.status==='rejected').reason.message,/Duplicate payment reference/);
    const afterPayment=await loadState(owner);
    assert.equal(afterPayment.data.payments.length,1);
    assert.equal(afterPayment.data.payments[0].amount,500);
    await assert.rejects(commitRecordChanges(owner,afterPayment.version,[create('payments',{
      ...payment,id:'wrong-currency',reference:'new-ref',currency:'IRR',
    })]),/incompatible/);
    await assert.rejects(commitRecordChanges(owner,afterPayment.version,[create('payments',{
      ...payment,id:'overpayment',reference:'over-ref',amount:751,
    })]),/exceed/);
    const saved=afterPayment.data.payments[0];
    await assert.rejects(commitRecordChanges(owner,afterPayment.version,[{kind:'payments',id:saved.id,action:'delete'}]),/immutable/);
    await assert.rejects(commitRecordChanges(owner,afterPayment.version,[{kind:'invoices',id:invoice.id,action:'replace',
      record:{...invoice,direction:'payable'}}]),/only be voided/);
    await assert.rejects(commitRecordChanges(owner,afterPayment.version,[{kind:'invoices',id:invoice.id,action:'replace',
      record:{...invoice,state:'void'}}]),/incompatible/);
    assert.equal((await loadState(owner)).version,afterPayment.version);
    const unpaid={...invoice,id:'unpaid-invoice',reference:'UNPAID-01'};
    const unpaidVersion=await commitRecordChanges(owner,afterPayment.version,[create('invoices',unpaid)]);
    const voidedVersion=await commitRecordChanges(owner,unpaidVersion,[{kind:'invoices',id:unpaid.id,action:'replace',
      record:{...unpaid,state:'void'}}]);
    await assert.rejects(commitRecordChanges(owner,voidedVersion,[{kind:'invoices',id:unpaid.id,action:'replace',
      record:unpaid}]),/only be voided/);
    assert.equal((await loadState(owner)).data.invoices.find(row=>row.id===unpaid.id).state,'void');
    const quote={id:'fixture-rate',projectId:'beta',from:'USD',to:'IRR',rate:'8421.25',
      source:'Synthetic fixture statement',observedAt:'2026-01-15T00:00:00.000Z'};
    const ratesVersion=await commitRecordChanges(owner,voidedVersion,[create('exchangeRates',quote)]);
    const limited=await accountByUser(editorId);
    assert.deepEqual((await loadState(limited)).data.exchangeRates,[]);
    await assert.rejects(commitRecordChanges(limited,ratesVersion,[create('exchangeRates',{
      ...quote,id:'blocked-rate',projectId:'alpha',
    })]),/permission/);
    await assert.rejects(commitRecordChanges(owner,ratesVersion,[{kind:'exchangeRates',id:quote.id,action:'delete'}]),/immutable/);
    const ledgerRestore='projectos_restore_ledger_'+suffix;
    await admin.query('CREATE DATABASE "'+ledgerRestore+'"');
    created.push(ledgerRestore);
    process.env.PROJECTOS_RESTORE_URL=connectionFor(ledgerRestore);
    const ledgerBackup=join(area,'ledger.posbak');
    assert.equal(JSON.parse(run('postgres-backup.mjs','backup',ledgerBackup)).ok,true);
    assert.equal(verifyOffline(ledgerBackup).dataDecoded,true);
    assert.equal(JSON.parse(run('postgres-backup.mjs','restore',ledgerBackup)).ok,true);
    await closeDatabase();
    process.env.PROJECTOS_DATABASE_URL=connectionFor(ledgerRestore);
    const restoredLedger=(await loadState(owner)).data;
    assert.deepEqual(restoredLedger.payments,[saved]);
    assert.equal(restoredLedger.invoices.find(row=>row.id===unpaid.id).state,'void');
    assert.deepEqual(restoredLedger.exchangeRates,[quote]);
  } finally {
    await closeDatabase();
    for (const db of created.reverse()) await admin.query('DROP DATABASE "' + db + '"');
    await admin.end();
    rmSync(area, { recursive:true, force:true, maxRetries:5 });
  }
});
