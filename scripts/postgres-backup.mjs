import { backupPostgres, restorePostgres, verifyPostgresBackup } from './postgres-archive.mjs';

try {
  const [mode, file] = process.argv.slice(2);
  if (!file || !['backup', 'verify', 'restore'].includes(mode)) throw new Error('Usage: backup|verify|restore <archive.posbak>');
  const passphrase = process.env.PROJECTOS_BACKUP_PASSPHRASE;
  const report = mode === 'backup'
    ? await backupPostgres(file, process.env.PROJECTOS_DATABASE_URL, passphrase)
    : mode === 'verify' ? await verifyPostgresBackup(file, passphrase)
    : await restorePostgres(file, process.env.PROJECTOS_RESTORE_URL, passphrase);
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('PostgreSQL archive operation failed:', error.code ?? error.message);
  process.exitCode = 1;
}
