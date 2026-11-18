import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/functional.spec.ts',
  fullyParallel: true,
  workers: 2,
  timeout: 90_000,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PROJECTOS_PLAYWRIGHT_CHROMIUM },
  },
});