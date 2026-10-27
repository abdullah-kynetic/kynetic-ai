import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {}
  },
  webServer: {
    command: `bun run start -p ${port}`,
    url: `http://localhost:${port}/dashboard`,
    env: {
      APP_BASE_URL: `http://localhost:${port}`,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://test:test@127.0.0.1:5432/test',
      DATABASE_URL_AUTH:
        process.env.DATABASE_URL_AUTH ?? 'postgres://test:test@127.0.0.1:5432/test',
      BETTER_AUTH_SECRET: 'e2e-only-secret-not-for-real-use-0000',
      APP_ENCRYPTION_KEY: 'e2e-only-key-not-for-real-use-00000',
      COMPONENT_GALLERY: '1'
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
