import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// P1-3 and P1-7: custom field values can be entered on a contact, a company and a deal, and the
// screens that carry the inputs pass the accessibility scan on desktop and at 390 px.

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

// The page can be clicked before it has hydrated; retry the click until the panel is open.
async function openEditPanel(page: import('@playwright/test').Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test('owner sets a custom value on a contact, a company and a deal', async ({
  authenticatedPage: page
}) => {
  // Contact: the leads panel has an input for the seeded "Roof age" field.
  await page.goto('/dashboard/contacts');
  await page.getByRole('link', { name: 'Contact a' }).waitFor();
  await page.getByRole('button', { name: 'Edit Contact a' }).click();
  const roofAge = page.getByLabel('Roof age');
  await expect(roofAge).toBeVisible();
  await roofAge.fill('12');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Contact saved.')).toBeVisible();

  await page.getByRole('link', { name: 'Contact a' }).click();
  await expect(page.getByText('Roof age')).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();

  // Deal: edit from the deal page, then see it on the page.
  await page.getByRole('link', { name: 'Roof replacement' }).click();
  await openEditPanel(page);
  await page.getByLabel('Permit cost').fill('1,250.50');
  await page.getByRole('button', { name: 'Save deal' }).click();
  await expect(page.getByText('$1,250.50').first()).toBeVisible();

  // A value that does not fit the type is refused with the reason next to the input.
  await openEditPanel(page);
  await page.getByLabel('Permit cost').fill('lots');
  await page.getByRole('button', { name: 'Save deal' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /amount/ })).toBeVisible();
});

test('owner sets a custom value on a company', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard/companies');
  await page.getByRole('link', { name: 'Company a' }).click();
  const crew = page.getByLabel('Crew size');
  await crew.fill('8');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Crew size')).toHaveValue('8');
});

for (const [name, size] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['390 px', { width: 390, height: 844 }]
] as const) {
  test(`custom field inputs pass the accessibility scan at ${name}`, async ({
    authenticatedPage: page
  }) => {
    await page.setViewportSize(size);
    await page.goto('/dashboard/companies');
    await page.getByRole('link', { name: 'Company a' }).click();
    await expect(page.getByLabel('Crew size')).toBeVisible();
    // The route-change progress bar is not page content.
    await page.addStyleTag({ content: '#nprogress { display: none !important; }' });
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(',')}`)).toEqual([]);
  });
}
