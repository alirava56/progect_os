import { defineConfig } from '@playwright/test';

const port = 4319;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/project-lifecycle.spec.ts',
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    actionTimeout: 12_000,
    navigationTimeout: 25_000,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/dashboard`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
