import { expect, test } from '@playwright/test';

// Signed-in module gating (crm off returns 403) is covered by the integration suite and the
// ModuleDisabledError mapping; the browser-level check here is that the pages are not public.
test('F-10: a signed-out visitor cannot load the companies pages', async ({ page }) => {
  for (const path of ['/dashboard/companies', '/dashboard/companies/new']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in$/);
  }
});
