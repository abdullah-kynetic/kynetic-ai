import { z } from 'zod';
import type { Tx } from '../db/client';
import { ValidationError } from '../errors';
import {
  addAgencyExpense,
  addAgencyReferral,
  addAgencyRevenue,
  agencyFinanceCsv,
  approveAgencyReferral,
  deleteAgencyExpense,
  editAgencyExpense,
  getAgencyFinance
} from '../agency/finance';
import { createAgencyInvoice, getAgencyBilling } from '../agency/billing';
import { financeSummaryForMonth } from '../agency/finance-math';
import { parseInput, uuidSchema } from '../validation';
import type { ServiceContext } from '../service-auth/authenticate';
import { requireAgency } from './agency';

// Agency finance, billing and referrals for the service API (D3). Admin key only. Records are written
// here; money is integer cents. No live charge is possible through the API: invoices are drafts only,
// and the portal's charge path refuses livemode.

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM.');

export async function getServiceAgencyFinance(tx: Tx, svc: ServiceContext) {
  return getAgencyFinance(await requireAgency(tx, svc));
}

/** Summary for one month (YYYY-MM), or the current Pacific month when none is given. */
export async function getServiceFinanceSummary(tx: Tx, svc: ServiceContext, month?: string) {
  const parsed = month === undefined ? undefined : parseInput(monthSchema, month);
  const data = await getAgencyFinance(await requireAgency(tx, svc));
  return financeSummaryForMonth(data.months, parsed);
}

export async function exportServiceFinanceCsv(tx: Tx, svc: ServiceContext, tab: string | null) {
  const allowed = ['revenue', 'expenses', 'referrals', 'case-studies'] as const;
  if (!tab || !(allowed as readonly string[]).includes(tab)) {
    throw new ValidationError({ tab: ['invalid'] });
  }
  const data = await getAgencyFinance(await requireAgency(tx, svc));
  return agencyFinanceCsv(tab as (typeof allowed)[number], data);
}

export async function addServiceExpense(tx: Tx, svc: ServiceContext, body: unknown) {
  return addAgencyExpense(await requireAgency(tx, svc), body);
}

export async function editServiceExpense(tx: Tx, svc: ServiceContext, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  return editAgencyExpense(await requireAgency(tx, svc), { ...(body as object), id });
}

export async function deleteServiceExpense(tx: Tx, svc: ServiceContext, id: string) {
  return deleteAgencyExpense(await requireAgency(tx, svc), id);
}

export async function addServiceRevenue(tx: Tx, svc: ServiceContext, body: unknown) {
  return addAgencyRevenue(await requireAgency(tx, svc), body);
}

export async function addServiceReferral(tx: Tx, svc: ServiceContext, body: unknown) {
  return addAgencyReferral(await requireAgency(tx, svc), body);
}

export async function approveServiceReferral(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  return approveAgencyReferral(await requireAgency(tx, svc), id);
}

export async function getServiceAgencyBilling(tx: Tx, svc: ServiceContext) {
  return getAgencyBilling(await requireAgency(tx, svc));
}

/** A draft only. The portal's charge and reminder paths are not reachable from here. */
export async function createServiceInvoiceDraft(tx: Tx, svc: ServiceContext, body: unknown) {
  return createAgencyInvoice(await requireAgency(tx, svc), body);
}
