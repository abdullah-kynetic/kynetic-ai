import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('M17-01 F-105: proposal draft saves/renders safely and preserves stale-tab edits', async ({
  adminPage,
  authenticatedPage,
  vaPage
}) => {
  await adminPage.goto('/admin/agency');
  const setup = adminPage.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await setup.isVisible()) await setup.click();
  await adminPage.getByLabel('Name', { exact: true }).fill('Synthetic Proposal Browser Lead');
  await adminPage
    .getByLabel('Synthetic email', { exact: true })
    .fill('proposal-browser@example.test');
  await adminPage.getByLabel('Lead source', { exact: true }).selectOption('inbound:form');
  await adminPage.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(
    adminPage.getByText('proposal-browser@example.test', { exact: false })
  ).toBeVisible();
  await adminPage.goto('/admin/agency/proposals');
  await adminPage
    .getByLabel('Agency deal', { exact: true })
    .selectOption({ label: 'Synthetic Proposal Browser Lead' });
  await adminPage.getByRole('button', { name: 'Open or create draft' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Edit proposal draft' })).toBeVisible();
  const editorUrl = adminPage.url();
  const stale = await adminPage.context().newPage();
  await stale.goto(editorUrl);
  await stale.getByLabel('Problem', { exact: true }).fill('Keep my unsaved stale-tab text.');
  await adminPage.getByLabel('Draft title', { exact: true }).fill('Synthetic proposal preview');
  const unsafe = '<img src=x onerror="window.proposalUnsafe=true">';
  await adminPage.getByLabel('Problem', { exact: true }).fill(unsafe);
  await adminPage
    .getByLabel('Agentic Solution', { exact: true })
    .fill('Synthetic proposed approach.');
  await adminPage
    .getByLabel('Roadmap', { exact: true })
    .fill('Synthetic step one.\nSynthetic step two.');
  await adminPage
    .getByLabel('ROI', { exact: true })
    .fill('Assumptions to review; no promised return.');
  await adminPage.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(adminPage.getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
  await stale.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(
    stale.getByRole('alert').filter({ hasText: 'A newer draft was saved elsewhere' })
  ).toBeVisible();
  await expect(stale.getByLabel('Problem', { exact: true })).toHaveValue(
    'Keep my unsaved stale-tab text.'
  );
  await stale.close();
  await adminPage.reload();
  await expect(adminPage.getByLabel('Problem', { exact: true })).toHaveValue(unsafe);
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await expect(adminPage.locator('#nprogress')).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page: adminPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  await adminPage.getByRole('link', { name: 'Preview saved draft' }).click();
  await expect(
    adminPage.getByRole('heading', { name: 'Synthetic proposal preview' })
  ).toBeVisible();
  for (const title of ['Problem', 'Agentic Solution', 'Roadmap', 'ROI'])
    await expect(adminPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const preview = adminPage.getByRole('article', { name: 'Proposal draft preview' });
  await expect(preview.getByText(unsafe, { exact: true })).toBeVisible();
  expect(await preview.locator('img').count()).toBe(0);
  expect(
    await adminPage.evaluate(() => (window as unknown as Record<string, unknown>).proposalUnsafe)
  ).toBeUndefined();
  await expect(adminPage.locator('#nprogress')).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page: adminPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  const previewPath = new URL(adminPage.url()).pathname;
  await authenticatedPage.goto(previewPath);
  await expect(
    authenticatedPage.getByRole('article', { name: 'Proposal draft preview' })
  ).not.toBeVisible();
  await vaPage.goto(previewPath);
  await expect(vaPage.getByRole('article', { name: 'Proposal draft preview' })).not.toBeVisible();
});
