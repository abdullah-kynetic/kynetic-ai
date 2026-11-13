import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// P1-7: the pages and panels phase 1 added or changed pass the WCAG 2.2 A/AA scan on desktop and at
// 390 px, and nothing scrolls sideways on a phone.

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const sizes = [
  ['desktop', { width: 1440, height: 1000 }],
  ['390 px', { width: 390, height: 844 }]
] as const;

async function scan(page: Page, label: string) {
  // Hover is a different state: keep the pointer off the control that was just clicked.
  await page.mouse.move(0, 0);
  // The route-change progress bar is not page content.
  await page.addStyleTag({
    content:
      '#nprogress { display: none !important; } *, *::before, *::after { transition: none !important; animation: none !important; }'
  });
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(
    results.violations.map(
      (v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(',')).join(' | ')}`
    )
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
}

async function mockImport(page: Page) {
  const batchId = '88888888-8888-4888-8888-888888888888';
  await page.route('**/api/my-imports', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        batch: { id: batchId },
        headers: ['First Name', 'Last Name', 'Phone', 'Email']
      })
    })
  );
  await page.route(`**/api/my-imports/${batchId}/dry-run`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        report: {
          total: 4,
          ok: 2,
          failed: 1,
          duplicates: 1,
          issues: [{ row: 4, reason: 'phones: invalid_phone' }]
        }
      })
    })
  );
  await page.route(`**/api/my-imports/${batchId}/commit`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        result: { imported: 2, filled: 0, skipped: 1, failed: 1, consents: 0 }
      })
    })
  );
}

for (const [name, size] of sizes) {
  test(`Import leads passes the scan at ${name}, in every step`, async ({
    authenticatedPage: page
  }) => {
    test.setTimeout(90_000);
    await mockImport(page);
    await page.setViewportSize(size);
    await page.goto('/dashboard/import');
    await expect(page.getByRole('heading', { name: 'Import leads' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await scan(page, `import start ${name}`);

    await page.getByLabel('CSV or Excel file').setInputFiles({
      name: 'leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('First Name,Last Name,Phone,Email')
    });
    await expect(page.getByRole('button', { name: 'Upload file' })).toBeEnabled();
    await page.getByRole('button', { name: 'Upload file' }).click();
    await expect(page.getByText('2. Match your columns', { exact: true })).toBeVisible();
    await scan(page, `import mapping ${name}`);
    await page.screenshot({
      path: `test-results/phase1-import-mapping-${name.replace(' ', '')}.png`
    });

    await page.getByRole('button', { name: 'Check the file' }).click();
    await expect(page.getByTestId('dry-run-report')).toBeVisible();
    await scan(page, `import review ${name}`);
    await page.screenshot({
      path: `test-results/phase1-import-review-${name.replace(' ', '')}.png`
    });

    await page.getByRole('button', { name: 'Import 2 leads' }).click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    await scan(page, `import result ${name}`);
  });

  test(`Contact panel with custom fields passes the scan at ${name}`, async ({
    authenticatedPage: page
  }) => {
    await page.setViewportSize(size);
    await page.goto('/dashboard/contacts');
    await page.waitForLoadState('networkidle');
    await expect(async () => {
      await page.getByRole('button', { name: 'Add contact' }).click();
      await expect(page.getByLabel('Roof age')).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
    await scan(page, `contact panel ${name}`);
    await page.screenshot({
      path: `test-results/phase1-contact-panel-${name.replace(' ', '')}.png`
    });
  });

  test(`Deal panel with custom fields passes the scan at ${name}`, async ({
    authenticatedPage: page
  }) => {
    await page.setViewportSize(size);
    await page.goto('/dashboard/contacts');
    await page.getByRole('link', { name: 'Contact a' }).click();
    await page.getByRole('link', { name: 'Roof replacement' }).click();
    await page.waitForLoadState('networkidle');
    await expect(async () => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByLabel('Permit cost')).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
    await scan(page, `deal panel ${name}`);
  });

  test(`Company page with custom fields passes the scan at ${name}`, async ({
    authenticatedPage: page
  }) => {
    await page.setViewportSize(size);
    await page.goto('/dashboard/companies');
    await page.getByRole('link', { name: 'Company a' }).click();
    await expect(page.getByLabel('Crew size')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await scan(page, `company ${name}`);
  });
}
