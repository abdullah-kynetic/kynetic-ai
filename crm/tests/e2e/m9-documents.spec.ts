import { expect, test } from './fixtures';

test('F-103 owner sees a shared document and a tenant download route', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard/documents');
  await expect(authenticatedPage.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(authenticatedPage.getByText('Agreement', { exact: true })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    /^\/api\/documents\/[0-9a-f-]+\/download$/
  );
});

test('F-103 admin upload form accepts a synthetic PDF and reports completion', async ({ adminPage }) => {
  await adminPage.route('**/api/admin/clients/*/documents', async (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, document: { id: '77777777-7777-4777-8777-777777777777', title: 'Synthetic proposal' } })
  }));
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/documents');
  await adminPage.getByLabel('Title').fill('Synthetic proposal');
  await adminPage.getByLabel('Type').selectOption('proposal');
  await adminPage.locator('input[type=file]').setInputFiles({ name: 'proposal.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 synthetic') });
  await adminPage.getByRole('button', { name: 'Upload document' }).click();
  await expect(adminPage.getByRole('status')).toHaveText('Document uploaded.');
});
