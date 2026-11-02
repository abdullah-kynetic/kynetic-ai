import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('M16 F-05/F-19/F-74: manual dialer records outcomes and campaigns without placing calls', async ({
  adminPage,
  vaPage
}) => {
  await adminPage.goto('/admin/agency');
  const setup = adminPage.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await setup.isVisible()) await setup.click();
  await adminPage.getByLabel('Name', { exact: true }).fill('Synthetic Dialer Browser Lead');
  await adminPage
    .getByLabel('Synthetic email', { exact: true })
    .fill('dialer-browser@example.test');
  await adminPage.getByLabel('Synthetic phone (optional)', { exact: true }).fill('+12025550123');
  await adminPage.getByLabel('State (required for dialer)', { exact: true }).selectOption('CA');
  await adminPage.getByLabel('Lead source', { exact: true }).selectOption('outbound:cold_call');
  await adminPage.getByRole('button', { name: 'Add lead', exact: true }).click();
  await adminPage.goto('/admin/agency/campaigns');
  await adminPage.getByLabel('Campaign name').fill('Synthetic browser campaign');
  await adminPage.getByLabel('Draft call script').fill('Draft: synthetic browser script only.');
  await adminPage.getByRole('button', { name: 'Create campaign', exact: true }).click();
  const campaign = adminPage.getByRole('region', { name: 'Synthetic browser campaign' });
  await campaign
    .getByLabel('Assign lead', { exact: true })
    .selectOption({ label: 'Synthetic Dialer Browser Lead' });
  await campaign.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(campaign.getByText('1 assigned · 0 manual outcomes')).toBeVisible();
  await campaign.getByRole('link', { name: 'Open campaign queue' }).click();
  await expect(
    adminPage.getByRole('heading', { name: 'Synthetic Dialer Browser Lead' })
  ).toBeVisible();
  await expect(adminPage.getByText('+12025550123', { exact: true })).toBeVisible();
  await expect(adminPage.getByText('Draft: synthetic browser script only.')).toBeVisible();
  await adminPage.setViewportSize({ width: 390, height: 844 });
  expect(
    // #nprogress is the third-party route-change bar (nextjs-toploader), present mid-navigation only.
    (
      await new AxeBuilder({ page: adminPage })
        .exclude('#nprogress')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  await adminPage.getByLabel('Notes (optional)').fill('Synthetic manual outcome.');
  await adminPage.getByRole('button', { name: 'interested', exact: true }).click();
  await expect(adminPage.getByText('No eligible leads remain in this queue.')).toBeVisible();
  await expect(
    adminPage
      .getByRole('listitem')
      .filter({ hasText: 'Synthetic Dialer Browser Lead · interested' })
  ).toBeVisible();
  await adminPage.goto('/admin/agency/campaigns');
  await expect(
    adminPage
      .getByRole('region', { name: 'Synthetic browser campaign' })
      .getByText('1 assigned · 1 manual outcomes')
  ).toBeVisible();
  expect(
    // #nprogress is the third-party route-change bar (nextjs-toploader), present mid-navigation only.
    (
      await new AxeBuilder({ page: adminPage })
        .exclude('#nprogress')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  await vaPage.goto('/admin/agency/dialer');
  await expect(vaPage.getByRole('heading', { name: 'Human dialer' })).not.toBeVisible();
  await vaPage.goto('/admin/agency/campaigns');
  await expect(vaPage.getByRole('heading', { name: 'Agency campaigns' })).not.toBeVisible();
});
