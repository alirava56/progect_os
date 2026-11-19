import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request, test as playwright } from '@playwright/test';

export const setupToken = 'this-is-a-public-test-only-token-not-a-secret';
export type Origin = { Origin: string; 'Sec-Fetch-Site': 'same-origin' };
const testTls = (appURL: string) => appURL.startsWith('https://127.0.0.1:');
export function testRequest(appURL: string) {
  return request.newContext({baseURL:appURL,ignoreHTTPSErrors:testTls(appURL)});
}

export async function startTestApp({ sqlitePath, postgresUrl, enforceMfa = false }: {
  sqlitePath: string; postgresUrl?: string; enforceMfa?: boolean;
}) {
  const server = fork(resolve('scripts/prepare-e2e.mjs'), [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^PROJECTOS_/i.test(name))),
      NODE_ENV: 'production',
      PROJECTOS_DB_PATH: sqlitePath,
      PROJECTOS_DATABASE_URL: postgresUrl ?? '',
      PROJECTOS_REQUIRE_MFA: enforceMfa ? 'enabled' : 'disabled',
      PROJECTOS_SETUP_TOKEN: setupToken,
      PROJECTOS_MFA_ENCRYPTION_KEY: '35'.repeat(32),
      PROJECTOS_TEST_TLS_KEY: process.env.PROJECTOS_TEST_TLS_KEY ?? '',
      PROJECTOS_TEST_TLS_CERT: process.env.PROJECTOS_TEST_TLS_CERT ?? '',
      PROJECTOS_GITHUB_TOKEN: '',
      PROJECTOS_AI_ENABLED: 'disabled',
      PROJECTOS_TELEGRAM_NOTIFICATIONS: 'disabled',
    },
  });
  let logs = '';
  const append = (data: Buffer) => { logs = (logs + data.toString()).slice(-4000); };
  server.stdout?.on('data', append);
  server.stderr?.on('data', append);
  const exited = new Promise<void>(done => server.once('close', () => done()));
  async function stop() {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await exited;
  }
  try {
    const url = await new Promise<string>((ready, fail) => {
      const timer = setTimeout(() => fail(new Error(`Test server startup timed out\n${logs}`)), 35_000);
      server.once('message', (message: { url?: unknown }) => {
        clearTimeout(timer);
        if (typeof message.url !== 'string' || !/^https?:\/\/127\.0\.0\.1:\d+$/.test(message.url)) {
          fail(new Error('Invalid test server endpoint'));
          return;
        }
        ready(message.url);
      });
      server.once('error', error => { clearTimeout(timer); fail(error); });
      server.once('exit', code => { clearTimeout(timer); fail(new Error(`Test server exited (${code})\n${logs}`)); });
    });
    return { url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

export const test = playwright.extend<{ appURL: string; origin: Origin; enforceMfa: boolean }>({
  enforceMfa: [false, { option:true }],
  appURL: async ({enforceMfa}, provide) => {
    const dir = await mkdtemp(join(tmpdir(), 'projectos-smoke-'));
    try {
      const server = await startTestApp({sqlitePath:join(dir, 'smoke.sqlite'), enforceMfa});
      try { await provide(server.url); }
      finally { await server.stop(); }
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 5 });
    }
  },
  baseURL: async ({ appURL }, provide) => { await provide(appURL); },
  ignoreHTTPSErrors: async ({ appURL }, provide) => { await provide(testTls(appURL)); },
  origin: async ({ appURL }, provide) => { await provide({ Origin: appURL, 'Sec-Fetch-Site': 'same-origin' }); },
});
