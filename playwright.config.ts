import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      testIgnore: /desktop-production\.spec\.ts/u,
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'desktop-chromium',
      testMatch: /desktop-production\.spec\.ts/u,
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
  ],
});