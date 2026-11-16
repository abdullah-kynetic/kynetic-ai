import { buildAdminDigest } from './alerts';
import { listAdminTenantOverview, type AdminTenantOverview } from './overview';
import { listStaffNotifications } from './platform-controls';
import { listSupportQueue, type SupportQueueRow } from '../support';
import { listAgencyAlerts } from '../agency';
import { agencyDigest } from '../agency/ops';
import { getAgencyDialer } from '../agency/dialer';
import { AppError } from '../errors';
import type { Db } from '../db/client';

export type TodayCaller = { userId: string; role: 'admin' | 'va' };
type StaffNotification = Awaited<ReturnType<typeof listStaffNotifications>>[number];

export type TodayData = {
  needsYouNow: {
    notices: StaffNotification[];
    agencyAlerts: { id: string; title: string; body: string }[];
    failedJobs: { name: string; count: number }[];
  } | null;
  salesToday: {
    dialer: {
      next: { id: string; name: string; phone: string | null; callbackDue: boolean } | null;
      remaining: number;
      callbacksDue: { id: string; name: string }[];
    };
    leads: { name: string; count: number }[];
    flaggedCalls: { name: string; count: number }[];
  } | null;
  clientsNeedingAttention: AdminTenantOverview[];
  support: { open: number; oldest: SupportQueueRow | null };
  dailySummary: { body: string; note: string } | null;
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
  const [digest, notices, agencyAlerts, dialer, agencySummary] = await Promise.all([
    buildAdminDigest(opts.now ?? new Date(), opts),
    listStaffNotifications(caller, opts),
    listAgencyAlerts({ id: caller.userId, kyneticRole: caller.role }, opts).catch(() => []),
    getAgencyDialer({ id: caller.userId, kyneticRole: caller.role }, undefined, opts).catch(
      (error) => {
        if (error instanceof AppError && error.code === 'NOT_FOUND')
          return { next: null, remaining: 0, callbacksDue: [] };
        throw error;
      }
    ),
    agencyDigest({ id: caller.userId, kyneticRole: caller.role }, opts).catch((error) => {
      if (error instanceof AppError && error.code === 'NOT_FOUND') return null;
      throw error;
    })
  ]);
  return {
    needsYouNow: { notices, agencyAlerts, failedJobs: digest.failedJobs },
    salesToday: {
      dialer: { next: dialer.next, remaining: dialer.remaining, callbacksDue: dialer.callbacksDue },
      leads: digest.leads,
      flaggedCalls: digest.flaggedCalls
    },
    clientsNeedingAttention: visibleTenants,
    support: { open: openSupport.length, oldest: openSupport[0] ?? null },
    dailySummary: agencySummary
      ? {
          body: agencySummary.body,
          note: 'In-app summaries at 8 a.m. Pacific. No external delivery.'
        }
      : null
  };
}
