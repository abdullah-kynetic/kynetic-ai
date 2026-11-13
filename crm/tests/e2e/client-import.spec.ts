import { expect, test } from './fixtures';

// P1-5 (browser side): a client owner works the Import leads page from file to result. The e2e
// server has no object storage, so, like the staff import spec, the API calls are answered by the
// test; the real intake, dry run, commit, consent and tenant rules are covered by the integration
// tests in client-import.test.ts and client-import-tenant-guard.test.ts.

const batchId = '88888888-8888-4888-8888-888888888888';
const headers = ['First Name', 'Last Name', 'Mobile Phone', 'Email', 'Notes'];

test('owner imports a file: columns are matched, the file is checked, then imported', async ({
  authenticatedPage: page
}) => {
  let dryRunBody: unknown = null;
  await page.route('**/api/my-imports', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, batch: { id: batchId, fileName: 'leads.csv' }, headers })
    })
  );
  await page.route(`**/api/my-imports/${batchId}/dry-run`, (route) => {
    dryRunBody = route.request().postDataJSON();
    return route.fulfill({
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
    });
  });
  await page.route(`**/api/my-imports/${batchId}/commit`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        result: { imported: 2, filled: 0, skipped: 1, failed: 1, consents: 1 }
      })
    })
  );

  await page.goto('/dashboard/import');
  await expect(page.getByRole('heading', { name: 'Import leads' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('CSV or Excel file').setInputFiles({
    name: 'leads.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(headers.join(','))
  });
  // The button is enabled only once the page has hydrated and has taken the file.
  await expect(page.getByRole('button', { name: 'Upload file' })).toBeEnabled();
  await page.getByRole('button', { name: 'Upload file' }).click();

  // The columns are matched from the headers; the consent columns stay unmatched.
  await expect(page.getByText('2. Match your columns', { exact: true })).toBeVisible();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('First Name');
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('Mobile Phone');
  await expect(page.getByLabel('Consent date (written YYYY-MM-DD)')).toHaveValue('');

  await page.getByRole('button', { name: 'Check the file' }).click();
  const report = page.getByTestId('dry-run-report');
  await expect(report).toBeVisible();
  await expect(report.getByText('Ready to add').locator('xpath=following-sibling::dd')).toHaveText(
    '2'
  );
  await expect(
    report.getByText('Already in your list').locator('xpath=following-sibling::dd')
  ).toHaveText('1');
  await expect(
    report.getByText('Cannot be imported').locator('xpath=following-sibling::dd')
  ).toHaveText('1');
  // The invalid row is listed with its row number.
  await expect(report.getByRole('cell', { name: '4', exact: true })).toBeVisible();
  expect(dryRunBody).toEqual({
    mapping: {
      firstName: 'First Name',
      lastName: 'Last Name',
      phone: 'Mobile Phone',
      email: 'Email'
    }
  });

  await page.getByRole('button', { name: 'Import 2 leads' }).click();
  await expect(page.getByTestId('import-result')).toContainText('2 new leads added');
  await expect(page.getByTestId('import-result')).toContainText('1 consent record saved');
});

test('a refused upload shows the reason and no mapping step', async ({
  authenticatedPage: page
}) => {
  await page.route('**/api/my-imports', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are not valid.',
          fieldErrors: { file: ['too_large'] }
        }
      })
    })
  );
  await page.goto('/dashboard/import');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('CSV or Excel file').setInputFiles({
    name: 'leads.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('phone\n4155550100')
  });
  // The button is enabled only once the page has hydrated and has taken the file.
  await expect(page.getByRole('button', { name: 'Upload file' })).toBeEnabled();
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '10 MB' })).toBeVisible();
  await expect(page.getByText('2. Match your columns', { exact: true })).toHaveCount(0);
});

test('only owners see the Import leads page', async ({ vaPage }) => {
  // A Kynetic VA is outside any client, so the page offers no import.
  await vaPage.goto('/dashboard/import');
  await expect(vaPage.getByRole('button', { name: 'Upload file' })).toHaveCount(0);
});
