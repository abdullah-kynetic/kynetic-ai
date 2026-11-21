import { z } from 'zod';
import { listAdminTenantOverview } from '../admin/overview';
import { listUsageMonth } from '../admin/platform-controls';
import {
  billingTotals,
  getTenantBilling,
  setTenantPlanTier,
  updateBillingProfile
} from '../billing';
import { parseInput, uuidSchema } from '../validation';
import { platformContext, type PlatformService } from '../service-auth/platform';

// Platform billing for the service API (E2). Owner's admin key only. Reads and plan or profile edits go
// through the portal's own billing functions, which check the admin role and audit. Nothing charges a
// card, sends an invoice or reaches Stripe for money: live charges and invoice emails are held (Tier B).

const actor = (plat: PlatformService) => ({ id: plat.userId, kyneticRole: 'admin' as const });
const planSchema = z
  .strictObject({
    plan: z.enum(['founding', 'value']).optional(),
    pricingTier: z.enum(['T1', 'T2', 'T3']).nullable().optional()
  })
  .refine((v) => v.plan !== undefined || v.pricingTier !== undefined, {
    message: 'nothing_to_change'
  });
const profileSchema = z.strictObject({
  billingStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  stripeCustomerId: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(4000).nullable().optional()
});
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM.');

/** Every client's plan and the totals of its live module lines, with a grand total. */
export async function getServicePlatformBilling(plat: PlatformService) {
  const overview = await listAdminTenantOverview(platformContext(plat));
  const clients = [];
  for (const row of overview) {
    const view = await getTenantBilling(actor(plat), row.tenantId);
    clients.push({
      tenantId: row.tenantId,
      name: view.tenant.name,
      plan: view.tenant.plan,
      pricingTier: view.tenant.pricingTier,
      ...billingTotals(view.lines)
    });
  }
  const totals = clients.reduce(
    (t, c) => ({
      setupCents: t.setupCents + c.setupCents,
      monthlyCents: t.monthlyCents + c.monthlyCents
    }),
    { setupCents: 0, monthlyCents: 0 }
  );
  return { clients, totals };
}

export async function getServiceClientBilling(plat: PlatformService, id: string) {
  parseInput(uuidSchema, id);
  return getTenantBilling(actor(plat), id);
}

export async function setServiceClientPlan(plat: PlatformService, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  const input = parseInput(planSchema, body);
  await setTenantPlanTier(actor(plat), { tenantId: id, ...input });
  return { updated: true };
}

export async function updateServiceBillingProfile(
  plat: PlatformService,
  id: string,
  body: unknown
) {
  parseInput(uuidSchema, id);
  const input = parseInput(profileSchema, body);
  await updateBillingProfile(actor(plat), { tenantId: id, ...input });
  return { updated: true };
}

export async function getServicePlatformUsage(plat: PlatformService, month?: string) {
  const parsed = month === undefined ? undefined : parseInput(monthSchema, month);
  return listUsageMonth(platformContext(plat), parsed);
}
