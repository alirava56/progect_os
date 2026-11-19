import { defineConfig } from '@playwright/test';
import smoke from './playwright.smoke.config';

export default defineConfig(smoke, {
  testMatch: '**/project-lifecycle.spec.ts',
  workers: 1,
  timeout: 180_000,
});
