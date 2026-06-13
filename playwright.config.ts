import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 15_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    headless: true,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
