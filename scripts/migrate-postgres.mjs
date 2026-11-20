import { readFile } from 'node:fs/promises';
import { closeDatabase, getPostgresPool } from './database.mjs';

const migrations = [
  ['001_initial', new URL('../schema/postgres/001_initial.sql', import.meta.url)],
  ['002_integrations', new URL('../schema/postgres/002_integrations.sql', import.meta.url)],
  ['003_monitor_metrics', new URL('../schema/postgres/003_monitor_metrics.sql', import.meta.url)],
  ['004_machine_disk_metrics', new URL('../schema/postgres/004_machine_disk_metrics.sql', import.meta.url)],
];
const client = await getPostgresPool().connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(3804521)');
  await client.query('CREATE TABLE IF NOT EXISTS projectos_schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for (const [id, path] of migrations) {
    const existing = await client.query('SELECT id FROM projectos_schema_migrations WHERE id=$1', [id]);
    if (existing.rowCount) continue;
    await client.query(await readFile(path, 'utf8'));
    await client.query('INSERT INTO projectos_schema_migrations(id) VALUES($1)', [id]);
    console.log('Applied', id);
  }
  await client.query('COMMIT');
  console.log('PostgreSQL schema is current');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('PostgreSQL migration failed', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  client.release();
  await closeDatabase();
}
