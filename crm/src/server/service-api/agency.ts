import { inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { agencyProspects, dncEntries } from '../db/schema';
import { AppError } from '../errors';
import { createAgencyLead, getAgencyWorkspace, listAgencyLeads } from '../agency';
import {
  createAgencyProspect,
  getProspectFunnel,
  listAgencyProspects,
  moveProspectsToSales
} from '../agency/prospects';
import type { StaffCaller } from '../admin/users';
import { parseInput } from '../validation';
import type { ServiceContext } from '../service-auth/authenticate';

// The agency workspace for the service API (D1). Admin key only: a client token gets 403 even with the
// scope ticked. The admin key names the workspace with X-Kynetic-Client; every call re-checks that this
// tenant is the agency one. The portal's agency functions open their own transactions, so they run
// beside the service transaction, not inside it.
// Nothing here contacts a prospect. Messages, campaign sends and dialer calls stay off (Tier B).

/** The owner behind the admin key, as a staff caller. Runs inside withServiceTenant. */
async function agencyCaller(tx: Tx, svc: ServiceContext): Promise<StaffCaller> {
  if (!svc.adminKeyId) throw new AppError('FORBIDDEN');
  const [row] = await tx.execute<{ owner: string | null }>(
    sql`select admin_api_key_owner(${svc.adminKeyId}::uuid) as owner`
  );
  if (!row?.owner) throw new AppError('FORBIDDEN');
  return { id: row.owner, kyneticRole: 'admin' };
}

/** Refuses unless this tenant is the agency workspace. A missing workspace reads as not found. */
async function requireAgency(tx: Tx, svc: ServiceContext): Promise<StaffCaller> {
  const caller = await agencyCaller(tx, svc);
  const workspace = await getAgencyWorkspace(caller, false);
  if (!workspace) throw new AppError('NOT_FOUND');
  if (workspace.tenantId !== svc.tenantId) throw new AppError('FORBIDDEN');
  return caller;
}

export async function listServiceAgencyProspects(tx: Tx, svc: ServiceContext, query: unknown) {
  return listAgencyProspects(await requireAgency(tx, svc), query);
}

export async function createServiceAgencyProspect(tx: Tx, svc: ServiceContext, body: unknown) {
  return createAgencyProspect(await requireAgency(tx, svc), body);
}

export async function getServiceProspectFunnel(tx: Tx, svc: ServiceContext) {
  return getProspectFunnel(await requireAgency(tx, svc));
}

/**
 * Moves prospects into Sales. A prospect whose phone is on the active do-not-call list is skipped
 * before the portal's move runs, so a DNC number never becomes a sales lead through the API.
 */
export async function moveServiceProspectsToSales(tx: Tx, svc: ServiceContext, input: unknown) {
  const ids = parseInput(z.array(z.uuid()).min(1).max(100), input);
  const caller = await requireAgency(tx, svc);
  const rows = await tx
    .select({
      id: agencyProspects.id,
      name: agencyProspects.businessName,
      phone: agencyProspects.phone
    })
    .from(agencyProspects)
    .where(inArray(agencyProspects.id, ids));
  const dncRows = await tx
    .select({ number: dncEntries.e164 })
    .from(dncEntries)
    .where(isNull(dncEntries.removedAt));
  const dnc = new Set(dncRows.map((r) => r.number));
  const blocked = rows.filter((r) => r.phone && dnc.has(r.phone));
  const blockedIds = new Set(blocked.map((r) => r.id));
  const allowed = ids.filter((id) => !blockedIds.has(id));
  const result = allowed.length
    ? await moveProspectsToSales(caller, allowed)
    : { moved: [], skipped: [] };
  return {
    moved: result.moved,
    skipped: [
      ...result.skipped,
      ...blocked.map((r) => ({
        prospectId: r.id,
        name: r.name,
        reason: 'On the do-not-call list.'
      }))
    ]
  };
}

export async function listServiceAgencyLeads(tx: Tx, svc: ServiceContext, query: unknown) {
  return listAgencyLeads(await requireAgency(tx, svc), query);
}

export async function createServiceAgencyLead(tx: Tx, svc: ServiceContext, body: unknown) {
  return createAgencyLead(await requireAgency(tx, svc), body);
}
