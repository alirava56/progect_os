import {defineConfig} from '@playwright/test';
const port=4319;
export default defineConfig({
  testDir:'./tests',testMatch:'**/functional.spec.ts',fullyParallel:false,workers:1,
  timeout:90_000,reporter:'list',
  use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',viewport:{width:1440,height:900},timezoneId:'Asia/Tehran',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PROJECTOS_PLAYWRIGHT_CHROMIUM}},
  webServer:{
    command:`node scripts/prepare-e2e.mjs ${port}`,
    url:`http://127.0.0.1:${port}/login`,reuseExistingServer:false,timeout:90_000,
    gracefulShutdown:{signal:'SIGTERM',timeout:5000},
  },
});
