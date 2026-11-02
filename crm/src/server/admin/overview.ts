import { sql } from 'drizzle-orm';
import { withPlatform, type PlatformContext } from '../tenancy';
import type { Db } from '../db/client';

export type AdminTenantOverview = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  pricingTier: string | null;
  leads30d: number;
  calls30d: number;
  appointments30d: number;
  bookingRate: number | null;
  guaranteeTarget: number | null;
  guaranteeBookings: number | null;
  guaranteeStartDate: string | null;
  integrationErrors: number;
  lastLoginAt: string | null;
  goLiveAt: string | null;
  modules: string[];
  healthScore: number;
  healthTone: 'green' | 'yellow' | 'red';
};

export function calculateHealthScore(input: {
  bookingRate: number | null;
  leads30d: number;
  integrationErrors: number;
  lastLoginAt: string | null;
  now?: Date;
}): number {
  const booking = Math.min(100, Math.round((input.bookingRate ?? 0) * 100));
  const leads = Math.min(
    100,
    input.leads30d > 0 ? Math.round(Math.min(input.leads30d, 20) * 5) : 0
  );
  const integrations =
    input.integrationErrors === 0 ? 100 : Math.max(0, 100 - input.integrationErrors * 10);
  const loginAge = input.lastLoginAt
    ? Math.max(0, (input.now ?? new Date()).getTime() - Date.parse(input.lastLoginAt))
    : Number.POSITIVE_INFINITY;
  const login = loginAge <= 7 * 86_400_000 ? 100 : loginAge <= 30 * 86_400_000 ? 60 : 0;
  return Math.round((booking + leads + integrations + login + (input.leads30d > 0 ? 100 : 0)) / 5);
}

export async function listAdminTenantOverview(
  ctx: PlatformContext,
  opts: { db?: Db } = {}
): Promise<AdminTenantOverview[]> {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_tenant_overview()`),
    opts
  );
  return (rows as unknown as Record<string, unknown>[]).map((r) => {
    const healthScore = calculateHealthScore({
      bookingRate: r.booking_rate === null ? null : Number(r.booking_rate),
      leads30d: Number(r.leads_30d),
      integrationErrors: Number(r.integration_errors),
      lastLoginAt: (r.last_login_at as string | null) ?? null
    });
    return {
      tenantId: String(r.tenant_id),
      slug: String(r.slug),
      name: String(r.name),
      plan: String(r.plan),
      status: String(r.status),
      pricingTier: (r.pricing_tier as string | null) ?? null,
      leads30d: Number(r.leads_30d),
      calls30d: Number(r.calls_30d),
      appointments30d: Number(r.appointments_30d),
      bookingRate: r.booking_rate === null ? null : Number(r.booking_rate),
      guaranteeTarget:
        r.guarantee_target_bookings === null ? null : Number(r.guarantee_target_bookings),
      guaranteeBookings: r.guarantee_bookings === null ? null : Number(r.guarantee_bookings),
      guaranteeStartDate: (r.guarantee_start_date as string | null) ?? null,
      integrationErrors: Number(r.integration_errors),
      lastLoginAt: (r.last_login_at as string | null) ?? null,
      goLiveAt: (r.go_live_at as string | null) ?? null,
      modules: Array.isArray(r.modules_enabled) ? (r.modules_enabled as string[]) : [],
      healthScore,
      healthTone: healthScore >= 70 ? 'green' : healthScore >= 40 ? 'yellow' : 'red'
    };
  });
}
