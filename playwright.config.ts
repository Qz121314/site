import { defineConfig, devices } from '@playwright/test';

const localServer = process.env.E2E_LOCAL_SERVER === '1';
const baseURL =
  process.env.BASE_URL ??
  (localServer ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:8787');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  timeout: 30_000,
  webServer: localServer
    ? {
        command:
          'pnpm --filter @site/storefront build && pnpm --filter @site/storefront preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
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
