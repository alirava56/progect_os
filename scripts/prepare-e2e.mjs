#!/usr/bin/env node
/** Start the production build with a disposable, run-scoped database. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid smoke-test port');

const directory = mkdtempSync(join(tmpdir(), 'projectos-smoke-'));
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start',
  '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: 'inherit',
  env: {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('PROJECTOS_'))),
    PROJECTOS_DB_PATH: join(directory, 'smoke.sqlite'),
    PROJECTOS_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    PROJECTOS_SETUP_TOKEN: 'this-is-a-public-test-only-token-not-a-secret',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', error => {
  rmSync(directory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
server.on('exit', code => {
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
