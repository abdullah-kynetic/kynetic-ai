import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// P3-2 and P3-7 (browser side): the Messages card on a contact page explains why sending is off,
// never offers a live send while OUTBOUND_ENABLED=false (the e2e server runs in stub mode with
// sending off), and passes the accessibility scan on desktop and at 390 px.

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const sizes = [
  ['desktop', { width: 1440, height: 1000 }],
  ['390 px', { width: 390, height: 844 }]
] as const;
const shotDir = process.env.P3_SHOTS;

async function scan(page: Page, label: string) {
  await page.mouse.move(0, 0);
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

async function openContact(page: Page) {
  await page.goto('/dashboard/contacts');
  const href = await page.locator('a[href^="/dashboard/contacts/"]').first().getAttribute('href');
  await page.goto(href!);
  await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

for (const [label, size] of sizes) {
  test(`contact Messages card explains a blocked send (${label})`, async ({
    authenticatedPage: page
  }) => {
    await page.setViewportSize(size);
    await openContact(page);
    const blocked = page.getByTestId('compose-blocked');
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText(/switched off|not agreed|not approved/i);
    await expect(page.getByRole('button', { name: /^Send text$/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await expect(page.getByTestId('compose-blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Send email$/ })).toBeDisabled();
    await scan(page, `contact messages ${label}`);
    if (shotDir)
      await page.screenshot({
        path: `${shotDir}/contact-${label.replace(' ', '')}.png`,
        fullPage: true
      });
  });
}
