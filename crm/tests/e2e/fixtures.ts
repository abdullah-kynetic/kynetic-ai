import { test as base, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const storageState = join('/tmp', 'kynetic-crm-e2e-owner.json');
const adminStorageState = join('/tmp', 'kynetic-crm-e2e-admin.json');

export const test = base.extend<{ authenticatedPage: Page; adminPage: Page }>({
  authenticatedPage: async ({ browser }, runFixture) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await runFixture(page);
    await context.close();
  },
  adminPage: async ({ browser }, runFixture) => {
    const context = await browser.newContext({ storageState: adminStorageState });
    const page = await context.newPage();
    await runFixture(page);
    await context.close();
  }
});

export { expect };
