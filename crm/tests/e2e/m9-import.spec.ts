import { expect, test } from './fixtures';

const batchId = '99999999-9999-4999-8999-999999999999';

test('F-90/F-91 admin import mapping wizard previews a CSV before commit', async ({
  adminPage
}) => {
  await adminPage.route('**/api/imports', async (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, batch: { id: batchId, fileName: 'synthetic-import.csv' } })
    })
  );
  await adminPage.route(`**/api/imports/${batchId}/dry-run`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, report: { total: 1, ok: 1, failed: 0, duplicates: 0 } })
    })
  );
  await adminPage.route(`**/api/imports/${batchId}/commit`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, result: { imported: 1, failed: 0 } })
    })
  );

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

test('F-90 admin can choose the company import record type and map its required name', async ({
  adminPage
}) => {
  const companyBatchId = '88888888-8888-4888-8888-888888888888';
  await adminPage.route('**/api/imports', async (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        batch: { id: companyBatchId, fileName: 'synthetic-companies.csv' }
      })
    })
  );
  await adminPage.route(`**/api/imports/${companyBatchId}/dry-run`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, report: { total: 1, ok: 1, failed: 0, duplicates: 0 } })
    })
  );

  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  await adminPage.getByLabel('Record type').selectOption('company');
  await adminPage.locator('input[type=file]').setInputFiles({
    name: 'synthetic-companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('business_name,website\nRoof Co,https://example.test')
  });
  await adminPage.getByRole('button', { name: 'Upload file' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Map company columns' })).toBeVisible();
  await adminPage.getByLabel('name').selectOption({ label: 'business_name' });
  await adminPage.getByRole('button', { name: 'Run dry-run' }).click();
  await expect(adminPage.getByText(/"total": 1/)).toBeVisible();
});

for (const scenario of [
  {
    entity: 'deal',
    headers: 'quote,value,stage',
    field: 'title',
    column: 'quote',
    file: 'synthetic-deals.csv'
  },
  {
    entity: 'note',
    headers: 'history,parent',
    field: 'body',
    column: 'history',
    file: 'synthetic-notes.csv'
  }
] as const) {
  test(`F-90 admin can map ${scenario.entity} imports`, async ({ adminPage }) => {
    const id =
      scenario.entity === 'deal'
        ? '55555555-5555-4555-8555-555555555555'
        : '44444444-4444-4444-8444-444444444444';
    await adminPage.route('**/api/imports', async (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, batch: { id, fileName: scenario.file } })
      })
    );
    await adminPage.route(`**/api/imports/${id}/dry-run`, async (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, report: { total: 1, ok: 1, failed: 0, duplicates: 0 } })
      })
    );
    await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
    await adminPage.getByLabel('Record type').selectOption(scenario.entity);
    await adminPage.locator('input[type=file]').setInputFiles({
      name: scenario.file,
      mimeType: 'text/csv',
      buffer: Buffer.from(`${scenario.headers}\nSynthetic,12300,New`)
    });
    await adminPage.getByRole('button', { name: 'Upload file' }).click();
    await expect(
      adminPage.getByRole('heading', { name: `Map ${scenario.entity} columns` })
    ).toBeVisible();
    await adminPage.getByLabel(scenario.field).selectOption({ label: scenario.column });
    if (scenario.entity === 'note') {
      await adminPage.getByLabel('dealExternalId').selectOption({ label: 'parent' });
    }
    await adminPage.getByRole('button', { name: 'Run dry-run' }).click();
    await expect(adminPage.getByText(/"total": 1/)).toBeVisible();
  });
}

test('F-90/F-91 wizard uploads a synthetic 50,000-row CSV and displays its dry-run report', async ({
  adminPage
}) => {
  const bulkId = '33333333-3333-4333-8333-333333333333';
  await adminPage.route('**/api/imports', async (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, batch: { id: bulkId, fileName: 'synthetic-50000.csv' } })
    })
  );
  await adminPage.route(`**/api/imports/${bulkId}/dry-run`, async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        report: { total: 50_000, ok: 50_000, failed: 0, duplicates: 0 }
      })
    })
  );
  const rows = ['first,email'];
  for (let index = 0; index < 50_000; index++)
    rows.push(`Synthetic ${index},bulk-${String(index).padStart(5, '0')}@example.test`);
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  await adminPage.locator('input[type=file]').setInputFiles({
    name: 'synthetic-50000.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(rows.join('\n'))
  });
  await adminPage.getByRole('button', { name: 'Upload file' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Map contact columns' })).toBeVisible();
  await adminPage.getByLabel('firstName').selectOption({ label: 'first' });
  await adminPage.getByLabel('email').selectOption({ label: 'email' });
  await adminPage.getByRole('button', { name: 'Run dry-run' }).click();
  await expect(adminPage.getByText(/"total": 50000/)).toBeVisible();
});

test('F-94 import batch id cannot be replayed under another tenant id', async ({ adminPage }) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  const status = await adminPage.evaluate(async () => {
    const response = await fetch('/api/imports/99999999-9999-4999-8999-999999999999/dry-run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: '22222222-2222-4222-8222-222222222222',
        mapping: { firstName: 'first_name' }
      })
    });
    return response.status;
  });
  expect(status).toBe(404);
});

test('F-90 reuses the last successful mapping for the same source system', async ({
  adminPage
}) => {
  const reuseBatchId = '66666666-6666-4666-8666-666666666666';
  await adminPage.route('**/api/imports', async (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, batch: { id: reuseBatchId, fileName: 'same-source.csv' } })
    })
  );
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  await adminPage.locator('input[type=file]').setInputFiles({
    name: 'same-source.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('first_name,phone\nAda,4155550123')
  });
  await adminPage.getByRole('button', { name: 'Upload file' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Map contact columns' })).toBeVisible();
  await expect(adminPage.locator('select[aria-label="firstName"]')).toHaveValue('first_name');
  await expect(adminPage.locator('select[aria-label="phone"]')).toHaveValue('phone');
});

test('F-93 admin can undo a committed batch from import history', async ({ adminPage }) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/imports');
  const batch = adminPage.locator('article').filter({ hasText: 'e2e.csv' });
  await expect(batch).toContainText('done');
  await batch.getByRole('button', { name: 'Undo batch' }).click();
  await expect(adminPage.locator('article').filter({ hasText: 'e2e.csv' })).toContainText('undone');
});

test('F-94 client owner and VA cannot open the tenant import wizard', async ({
  authenticatedPage,
  vaPage
}) => {
  const url = '/admin/clients/11111111-1111-4111-8111-111111111111/imports';
  const ownerResponse = await authenticatedPage.goto(url);
  expect(ownerResponse?.status()).toBe(403);
  const vaResponse = await vaPage.goto(url);
  expect(vaResponse?.status()).toBe(403);
});
