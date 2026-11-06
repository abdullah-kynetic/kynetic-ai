import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('agency roadmap: alerts, inbox, blocked compose, manual sequence, ops and billing drafts', async ({
  adminPage,
  authenticatedPage,
  vaPage
}) => {
  test.setTimeout(120_000);
  adminPage.setDefaultTimeout(15_000);
  await adminPage.goto('/admin/agency');
  const setup = adminPage.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await setup.isVisible()) await setup.click();
  await adminPage.getByLabel('Name', { exact: true }).fill('DEV Roadmap Prospect');
  await adminPage.getByLabel('Synthetic email').fill('roadmap-browser@example.test');
  await adminPage.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(
    adminPage.getByRole('listitem').filter({ hasText: 'DEV Roadmap Prospect' })
  ).toBeVisible();
  await expect(
    adminPage.getByLabel('Agency alerts').getByText('New agency lead', { exact: false }).first()
  ).toBeVisible();
  await expect(adminPage.getByLabel('Seven-day agency rates')).toContainText('Last seven days');
  await adminPage.goto('/admin/agency/inbox');
  await adminPage
    .getByRole('combobox', { name: 'Prospect', exact: true })
    .selectOption({ label: 'DEV Roadmap Prospect' });
  await adminPage.getByLabel('Platform', { exact: true }).fill('LinkedIn');
  await adminPage.getByLabel('Message', { exact: true }).fill('DEV manually recorded inbound DM');
  await adminPage.getByRole('button', { name: 'Save log' }).click();
  await expect(
    adminPage.getByRole('article').filter({ hasText: 'DEV manually recorded inbound DM' })
  ).toBeVisible();
  await adminPage.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('email');
  await adminPage.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(adminPage.getByText('No matching messages.')).toBeVisible();
  await adminPage.goto('/admin/agency/compose');
  await adminPage
    .getByRole('combobox', { name: 'Prospect', exact: true })
    .selectOption({ label: 'DEV Roadmap Prospect' });
  await adminPage.getByLabel('Message', { exact: true }).fill('DEV draft, never send');
  await adminPage.getByRole('button', { name: 'Save draft', exact: true }).click();
  const draft = adminPage.getByRole('article').filter({ hasText: 'DEV draft, never send' });
  await expect(draft).toBeVisible();
  await draft.getByRole('button', { name: 'Check gates / simulate' }).click();
  await expect(draft).toContainText('outbound disabled');
  await adminPage.goto('/admin/agency/campaigns');
  await adminPage.getByLabel('Campaign name', { exact: true }).fill('DEV Roadmap Sequence');
  await adminPage.getByRole('button', { name: 'Create campaign', exact: true }).click();
  const campaign = adminPage.getByRole('region', { name: 'DEV Roadmap Sequence', exact: true });
  await expect(campaign).toBeVisible();
  await campaign
    .getByLabel('Assign lead', { exact: true })
    .selectOption({ label: 'DEV Roadmap Prospect' });
  await campaign.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(campaign).toContainText('1 assigned');
  await campaign
    .getByLabel('Task instructions', { exact: true })
    .first()
    .fill('Review this prospect manually');
  await campaign.getByRole('button', { name: 'Save sequence' }).click();
  await campaign.getByRole('button', { name: 'Enroll assigned leads' }).click();
  await expect(campaign.getByRole('article')).toContainText('active');
  await campaign.getByRole('button', { name: 'Simulate step' }).click();
  await expect(campaign).toContainText('simulated: 1');
  await adminPage.goto('/admin/agency/ops');
  await expect(
    adminPage.getByRole('heading', { name: 'Client health', exact: true })
  ).toBeVisible();
  await adminPage.getByLabel('Inactive DEV workflow name').fill('DEV - Browser binding');
  await adminPage.getByLabel('Workflow ID').fill('DEV-browser-inactive');
  await adminPage.getByRole('button', { name: 'Save draft configuration' }).click();
  await expect(adminPage.getByLabel('Workflow ID')).toHaveValue('DEV-browser-inactive');
  await adminPage.goto('/admin/agency/billing');
  const terms = adminPage
    .locator('form')
    .filter({ has: adminPage.getByRole('heading', { name: 'Deal pricing', exact: true }) });
  await terms
    .getByRole('combobox', { name: 'Deal', exact: true })
    .selectOption({ label: 'DEV Roadmap Prospect' });
  await terms.getByLabel('Setup fee (USD)', { exact: true }).fill('100');
  await terms.getByLabel('Optional monthly fee (USD)').fill('25');
  await terms.getByLabel('Optional setup installments').fill('50,50');
  await terms.getByRole('button', { name: 'Save deal terms' }).click();
  await expect(adminPage.getByText(/\$100.00 setup/)).toBeVisible();
  const invoiceForm = adminPage
    .locator('form')
    .filter({ has: adminPage.getByRole('heading', { name: 'Create invoice draft', exact: true }) });
  await invoiceForm
    .getByRole('combobox', { name: 'Deal', exact: true })
    .selectOption({ label: 'DEV Roadmap Prospect' });
  await invoiceForm.getByLabel('Due date', { exact: true }).fill('2026-11-01');
  await invoiceForm.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(adminPage.getByRole('article')).toContainText('$50.00');
  await adminPage.getByRole('button', { name: 'Simulate payment failed', exact: true }).click();
  await expect(adminPage.getByRole('article').locator('[data-state="past_due"]')).toBeVisible();
  await adminPage.getByRole('button', { name: 'Draft overdue reminders' }).click();
  await expect(adminPage.getByText(/^Draft reminder:/)).toBeVisible();
  await adminPage.setViewportSize({ width: 1440, height: 1000 });
  await adminPage.goto('/admin/agency');
  await adminPage.screenshot({ path: '/tmp/kynetic-agency-after-desktop.png', fullPage: true });
  await adminPage.goto('/admin/agency/inbox');
  await adminPage.screenshot({ path: '/tmp/kynetic-inbox-after-desktop.png', fullPage: true });
  await adminPage.setViewportSize({ width: 390, height: 844 });
  for (const path of ['inbox', 'compose', 'campaigns', 'ops', 'billing']) {
    await adminPage.goto(`/admin/agency/${path}`);
    await expect(adminPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(adminPage.locator('#nprogress')).toHaveCount(0);
    const axe = await new AxeBuilder({ page: adminPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations, `${path} accessibility`).toEqual([]);
    expect(
      await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${path} horizontal overflow`
    ).toBe(true);
    await adminPage.screenshot({ path: `/tmp/kynetic-${path}-after-mobile.png`, fullPage: true });
  }
  await adminPage.emulateMedia({ reducedMotion: 'reduce' });
  const navigation = adminPage.getByRole('navigation', { name: 'Agency navigation', exact: true });
  const composeLink = navigation.getByRole('link', { name: 'Compose', exact: true });
  await composeLink.focus();
  await expect(composeLink).toBeFocused();
  await adminPage.keyboard.press('Enter');
  await expect(navigation.getByRole('link', { name: 'Compose', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  const durations = await adminPage
    .getByRole('button', { name: 'Save draft', exact: true })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(durations.split(',').every((v) => parseFloat(v) === 0)).toBe(true);
  await adminPage.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await expect(adminPage.locator('html')).toHaveClass(/dark/);
  await expect(adminPage.locator('#nprogress')).toHaveCount(0);
  const darkAxe = await new AxeBuilder({ page: adminPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(darkAxe.violations, 'dark/reduced-motion accessibility').toEqual([]);
  await adminPage.screenshot({ path: '/tmp/kynetic-compose-dark-mobile.png', fullPage: true });
  const noJs = await adminPage
    .context()
    .browser()!
    .newContext({ javaScriptEnabled: false, storageState: '/tmp/kynetic-crm-e2e-admin.json' });
  const basicPage = await noJs.newPage();
  await basicPage.goto(
    'http://localhost:' + (process.env.E2E_PORT ?? 3100) + '/admin/agency/inbox'
  );
  await expect(basicPage.getByRole('heading', { name: 'Agency inbox', exact: true })).toBeVisible();
  await expect(basicPage.getByRole('button', { name: 'Save log', exact: true })).toBeVisible();
  await noJs.close();
  for (const page of [authenticatedPage, vaPage]) {
    await page.goto('/admin/agency/billing');
    await expect(
      page.getByRole('heading', { name: 'Agency billing', exact: true })
    ).not.toBeVisible();
  }
});
