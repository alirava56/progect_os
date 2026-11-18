import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { closeDatabase, getPostgresPool } from './database.mjs';
import { decryptArchive, sqliteHeader } from './encrypted-archive.mjs';
import { importSnapshot, manifest, migrationError, openSnapshot } from './sqlite-import.mjs';

let scratch, snapshot;
try {
  const { values } = parseArgs({ options: {
    source: { type: 'string' }, backup: { type: 'string' }, apply: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
  } });
  if (!values.source || (values.apply && (values['dry-run'] || !values.backup))) throw new Error('INVALID_ARGUMENTS');
  snapshot = openSnapshot(resolve(values.source));
  const planned = manifest(snapshot);
  if (!values.apply) console.log(JSON.stringify({ ...planned, status: 'dry-run; PostgreSQL untouched' }));
  else {
    scratch = await mkdtemp(join(tmpdir(), 'projectos-migration-'));
    const restored = join(scratch, 'verified.sqlite');
    await decryptArchive(resolve(values.backup), restored, process.env.PROJECTOS_BACKUP_PASSPHRASE, sqliteHeader);
    const verified = openSnapshot(restored);
    try {
      if (manifest(verified).digest !== planned.digest) throw new Error('SQLITE_BACKUP_DOES_NOT_MATCH_SOURCE');
    } finally { verified.close(); }
    console.log(JSON.stringify(await importSnapshot(getPostgresPool(), snapshot, planned)));
  }
} catch (error) {
  console.error('SQLite import stopped:', migrationError(error),
    'Usage: --source path [--dry-run | --apply --backup path.posbak]');
  process.exitCode = 1;
} finally {
  snapshot?.close();
  if (scratch) await rm(scratch, { recursive: true, force: true, maxRetries: 4 });
  await closeDatabase();
}