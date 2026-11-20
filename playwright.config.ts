import { defineConfig } from '@playwright/test';
import smokeConfig from './playwright.smoke.config';

export default defineConfig({
  ...smokeConfig,
  testMatch: ['**/functional.spec.ts','**/release.spec.ts','**/responsive.spec.ts','**/workflows.spec.ts'],
  use: {...smokeConfig.use,actionTimeout:12_000,navigationTimeout:25_000,screenshot:'only-on-failure'},
});
