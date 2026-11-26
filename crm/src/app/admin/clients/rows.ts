import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import {
  defaultLifecycleStage,
  listAdminTenantOverview,
  listClientLifecycle,
  type AdminTenantOverview,
  type LifecycleStage
} from '@/server/admin';
import { requireUser } from '@/server/auth';
import { DEMO_CLIENT_PROFILES } from '@/server/db/seed/demo-client-profiles';

const demoSlugs = new Set(DEMO_CLIENT_PROFILES.map((profile) => profile.slug));
export const PROTECTED_DEMO_NAME = 'Kynetic Restoration (Demo)';

export type ClientRow = AdminTenantOverview & {
  stage: LifecycleStage;
  isDemo: boolean;
  locked: boolean;
};

/** Every client with its saved lifecycle stage, or the stage derived from its status. */
export async function loadClientRows() {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const ctx = { userId: user.id, role: user.kyneticRole };
  const [overview, saved] = await Promise.all([
    listAdminTenantOverview(ctx, { includeArchived: true }),
    listClientLifecycle(ctx)
  ]);
  const rows: ClientRow[] = overview.map((row) => {
    const isDemo = demoSlugs.has(row.slug);
    return {
      ...row,
      isDemo,
      locked: row.name === PROTECTED_DEMO_NAME,
      stage:
        saved.get(row.tenantId) ??
        defaultLifecycleStage({ status: row.status, isDemo, healthTone: row.healthTone })
    };
  });
  return { user, rows };
}
