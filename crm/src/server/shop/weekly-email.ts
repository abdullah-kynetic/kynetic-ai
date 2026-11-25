import { eq, sql } from 'drizzle-orm';
import { tenants } from '../db/schema';
import { getEnv } from '../env';
import type { TenantContextInput } from '../tenancy';
import { clientEmailAllowed } from '../reports/weekly-email';
import { shopRun, type ShopOpts } from './guard';

export type WeeklyEmailControl = {
  /** True only when both the platform flag and this client's flag are on. */
  allowed: boolean;
  label: string;
  note: string;
};

/**
 * What the weekly email control on the report says. It follows the same two-flag rule the sender
 * uses (`clientEmailAllowed`), so the screen can never claim an email goes out when it would not.
 */
export function weeklyEmailControl(
  envEnabled: boolean,
  tenantEnabled: boolean
): WeeklyEmailControl {
  if (clientEmailAllowed(envEnabled, tenantEnabled))
    return {
      allowed: true,
      label: 'Weekly email is on',
      note: 'The owner gets this report by email each week.'
    };
  return {
    allowed: false,
    label: 'Email me this report every week',
    note: 'Turns on when this is connected'
  };
}

export async function getWeeklyEmailControl(
  ctx: TenantContextInput,
  opts: ShopOpts & { envEnabled?: boolean } = {}
): Promise<WeeklyEmailControl> {
  return shopRun(ctx, opts, async (tx) => {
    const [row] = await tx
      .select({ enabled: tenants.weeklyEmailEnabled })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    let env = opts.envEnabled;
    if (env === undefined) {
      try {
        env = getEnv().CLIENT_EMAIL_ENABLED;
      } catch {
        env = false;
      }
    }
    return weeklyEmailControl(env, row?.enabled === true);
  });
}
