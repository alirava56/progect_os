import { backupPostgres, restorePostgres } from './postgres-archive.mjs';

try {
  const [mode, file] = process.argv.slice(2);
  if (!file || !['backup', 'restore'].includes(mode)) throw new Error('Usage: backup|restore <archive.posbak>');
  const passphrase = process.env.PROJECTOS_BACKUP_PASSPHRASE;
  const report = mode === 'backup'
    ? await backupPostgres(file, process.env.PROJECTOS_DATABASE_URL, passphrase)
    : await restorePostgres(file, process.env.PROJECTOS_RESTORE_URL, passphrase);
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('PostgreSQL backup or restore failed:', error.code ?? error.message);
  process.exitCode = 1;
}