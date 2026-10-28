import { expect, test } from './fixtures';

const batchId = '99999999-9999-4999-8999-999999999999';

test('F-90/F-91 admin import mapping wizard previews a CSV before commit', async ({ adminPage }) => {
  await adminPage.route('**/api/imports', async (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, batch: { id: batchId, fileName: 'synthetic-import.csv' } })
  }));
  await adminPage.route(`**/api/imports/${batchId}/dry-run`, async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, report: { total: 1, ok: 1, failed: 0, duplicates: 0 } })
  }));
  await adminPage.route(`**/api/imports/${batchId}/commit`, async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, result: { imported: 1, failed: 0 } })
  }));

  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  await adminPage.locator('input[type=file]').setInputFiles({
    name: 'synthetic-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('given_name,mobile\nAda,4155550123')
  });
  await adminPage.getByRole('button', { name: 'Upload file' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Map contact columns' })).toBeVisible();
  await adminPage.getByLabel('firstName').selectOption({ label: 'given_name' });
  await adminPage.getByLabel('phone').selectOption({ label: 'mobile' });
  await adminPage.getByRole('button', { name: 'Run dry-run' }).click();
  await expect(adminPage.getByText(/"total": 1/)).toBeVisible();
  await adminPage.getByRole('button', { name: 'Commit import' }).click();
  await expect(adminPage.getByRole('status')).toHaveText('Import committed.');
});
