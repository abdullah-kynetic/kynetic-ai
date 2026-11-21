import { z } from 'zod';
import type { Tx } from '../db/client';
import { getAgencyDialer, logAgencyCall, markAgencyDnc } from '../agency/dialer';
import { getAgencyRates, listAgencyInbox, logAgencyDm } from '../agency/inbox';
import {
  assignAgencyCampaign,
  createAgencyCampaign,
  listAgencyCampaigns
} from '../agency/campaigns';
import { agencyCampaignStats } from '../agency/campaign-engine';
import { getAgencyOps, saveAgencyOps } from '../agency/ops';
import { listAgencyAlerts } from '../agency';
import { parseInput, uuidSchema } from '../validation';
import type { ServiceContext } from '../service-auth/authenticate';
import { requireAgency } from './agency';

// Agency dialer log, DNC, inbox log, campaigns, ops, alerts and rates for the service API (D4). Admin
// key only. Nothing here dials, texts, emails or starts a campaign: calls and DMs are logged after a
// human made them, and campaign start, advance and digest publishing are held (Tier B). The dialer's
// quiet-hours and DNC checks are the portal's, so a blocked prospect comes back with its reason.

const dncSchema = z.strictObject({ contactId: uuidSchema });
const assignSchema = z.strictObject({ contactId: uuidSchema });
const daysSchema = z.coerce.number().int().min(1).max(30);

export async function getServiceAgencyDialer(tx: Tx, svc: ServiceContext, campaignId?: string) {
  const caller = await requireAgency(tx, svc);
  return getAgencyDialer(caller, campaignId);
}

/** Logs a call a human already made. Idempotent on eventId; a different body under the same id is refused. */
export async function logServiceAgencyCall(tx: Tx, svc: ServiceContext, body: unknown) {
  return logAgencyCall(await requireAgency(tx, svc), body);
}

/** Marks a contact do-not-call. Permanent: there is no route to undo it. */
export async function markServiceAgencyDnc(tx: Tx, svc: ServiceContext, body: unknown) {
  const { contactId } = parseInput(dncSchema, body);
  return markAgencyDnc(await requireAgency(tx, svc), contactId);
}

export async function listServiceAgencyInbox(tx: Tx, svc: ServiceContext, query: unknown) {
  return listAgencyInbox(await requireAgency(tx, svc), query);
}

/** Logs a DM a human sent or received. Nothing is sent by the API. */
export async function logServiceAgencyDm(tx: Tx, svc: ServiceContext, body: unknown) {
  return logAgencyDm(await requireAgency(tx, svc), body);
}

export async function listServiceAgencyCampaigns(tx: Tx, svc: ServiceContext) {
  return listAgencyCampaigns(await requireAgency(tx, svc));
}

/** Creates a draft campaign. Starting it is held (Tier B). */
export async function createServiceAgencyCampaign(tx: Tx, svc: ServiceContext, body: unknown) {
  return createAgencyCampaign(await requireAgency(tx, svc), body);
}

export async function assignServiceAgencyCampaign(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: unknown
) {
  parseInput(uuidSchema, id);
  const { contactId } = parseInput(assignSchema, body);
  return assignAgencyCampaign(await requireAgency(tx, svc), id, contactId);
}

export async function getServiceCampaignStats(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  return agencyCampaignStats(await requireAgency(tx, svc), id);
}

export async function getServiceAgencyOps(tx: Tx, svc: ServiceContext) {
  return getAgencyOps(await requireAgency(tx, svc));
}

/** Saves the DEV draft metadata only. The API never configures or calls n8n. */
export async function saveServiceAgencyOps(tx: Tx, svc: ServiceContext, body: unknown) {
  return saveAgencyOps(await requireAgency(tx, svc), body);
}

export async function listServiceAgencyAlerts(tx: Tx, svc: ServiceContext) {
  return listAgencyAlerts(await requireAgency(tx, svc));
}

/** Rates over the last `days` days (1 to 30, default 7). */
export async function getServiceAgencyRates(tx: Tx, svc: ServiceContext, days?: string) {
  const parsed = days === undefined ? undefined : parseInput(daysSchema, days);
  return getAgencyRates(await requireAgency(tx, svc), parsed === undefined ? {} : { days: parsed });
}
