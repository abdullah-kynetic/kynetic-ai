import type { Tx } from '../db/client';
import { AppError, ValidationError } from '../errors';
import { getClientUsage, resolveUsageMonth } from '../client-usage';
import { generateMonthlyReport, getReport, listReports, reportPeriodSchema } from '../reports/service';
import { searchContacts } from '../contacts/search';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerCtx, ownerUserId } from './owner';
import { parseInput, uuidSchema } from '../validation';

// Monthly reports, client usage and contact search for the service API (C12). Each runs as the
// tenant's owner, because the portal's readers check the owner role; the token's scope is the grant.
// Reports are one per month: generating again updates that month's row (the portal's upsert).

/** Runs inside withServiceTenant. */
export async function listServiceReports(tx: Tx, svc: ServiceContext) {
  const userId = await ownerUserId(tx, svc);
  return listReports(ownerCtx(svc, userId), { tx });
}

/** Runs inside withServiceTenant. A missing or foreign report is NOT_FOUND. */
export async function getServiceReport(tx: Tx, svc: ServiceContext, rawId: string) {
  const id = parseInput(uuidSchema, rawId);
  const userId = await ownerUserId(tx, svc);
  const row = await getReport(ownerCtx(svc, userId), id, { tx });
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

/** Runs inside withServiceTenant. `periodStart` is the first day of the month, YYYY-MM-01. */
export async function generateServiceReport(tx: Tx, svc: ServiceContext, periodStart: unknown) {
  if (typeof periodStart !== 'string' || !reportPeriodSchema.safeParse(periodStart).success) {
    throw new ValidationError({ periodStart: ['invalid'] });
  }
  const userId = await ownerUserId(tx, svc);
  return generateMonthlyReport(ownerCtx(svc, userId), periodStart, { tx });
}

/** Runs inside withServiceTenant. The month is YYYY-MM; the default is this month (UTC). */
export async function getServiceUsage(tx: Tx, svc: ServiceContext, rawMonth?: string) {
  const month = resolveUsageMonth(rawMonth, new Date().toISOString().slice(0, 10));
  const userId = await ownerUserId(tx, svc);
  return getClientUsage(ownerCtx(svc, userId), month, { tx });
}

/** Runs inside withServiceTenant. Contact search by name, phone or email; `q` is required. */
export async function searchServiceContacts(tx: Tx, svc: ServiceContext, q: string | null) {
  const text = (q ?? '').trim();
  if (!text) throw new ValidationError({ q: ['required'] });
  if (text.length > 100) throw new ValidationError({ q: ['too_long'] });
  const userId = await ownerUserId(tx, svc);
  return searchContacts(ownerCtx(svc, userId), { q: text }, { tx });
}
