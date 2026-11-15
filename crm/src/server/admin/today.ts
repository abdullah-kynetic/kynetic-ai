import { buildAdminDigest } from './alerts';
import { listAdminTenantOverview, type AdminTenantOverview } from './overview';
import { listStaffNotifications } from './platform-controls';
import { listSupportQueue, type SupportQueueRow } from '../support';
import type { Db } from '../db/client';

export type TodayCaller = { userId: string; role: 'admin' | 'va' };
type StaffNotification = Awaited<ReturnType<typeof listStaffNotifications>>[number];

export type TodayData = {
  needsYouNow: {
    notices: StaffNotification[];
    failedJobs: { name: string; count: number }[];
  } | null;
  salesToday: {
    leads: { name: string; count: number }[];
    flaggedCalls: { name: string; count: number }[];
  } | null;
  clientsNeedingAttention: AdminTenantOverview[];
  support: { open: number; oldest: SupportQueueRow | null };
  dailySummary: string | null;
};

export function todayVisibility(role: TodayCaller['role']) {
  return {
    needsYouNow: role === 'admin',
    salesToday: role === 'admin',
    clientsNeedingAttention: true,
    support: true,
    dailySummary: role === 'admin'
  } as const;
}

export async function getTodayData(
  caller: TodayCaller,
  opts: { db?: Db; now?: Date } = {}
): Promise<TodayData> {
  const tenants = await listAdminTenantOverview(caller, opts);
  const support = await listSupportQueue(caller, opts);
  const visibleTenants = tenants.filter((tenant) => tenant.healthTone !== 'green');
  const openSupport = support.filter((row) => row.status !== 'resolved');
  if (caller.role !== 'admin') {
    return {
      needsYouNow: null,
      salesToday: null,
      clientsNeedingAttention: visibleTenants,
      support: { open: openSupport.length, oldest: openSupport[0] ?? null },
      dailySummary: null
    };
  }
  const [digest, notices] = await Promise.all([
    buildAdminDigest(opts.now ?? new Date(), opts),
    listStaffNotifications(caller, opts)
  ]);
  return {
    needsYouNow: { notices, failedJobs: digest.failedJobs },
    salesToday: { leads: digest.leads, flaggedCalls: digest.flaggedCalls },
    clientsNeedingAttention: visibleTenants,
    support: { open: openSupport.length, oldest: openSupport[0] ?? null },
    dailySummary: `Failed jobs: ${digest.failedJobs.length}. Open support requests: ${openSupport.length}.`
  };
}
