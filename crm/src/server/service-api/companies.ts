import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  createCompany,
  deleteCompany,
  getCompanyDetail,
  listCompanies,
  updateCompany
} from '../companies/service';
import { createCompanySchema, updateCompanySchema } from '../companies/schemas';
import type { Tx } from '../db/client';
import { companies } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput } from '../validation';
import { plainNote } from './call-log';

// Companies for the service API (C3). Companies emit no events, so nothing reaches n8n from these writes.
// Free text is plain text. Contacts shown on a company detail carry no phone or email, as on the contact routes.

export const companyListQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
});
export type CompanyListQuery = z.output<typeof companyListQuerySchema>;

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });

/** Response shape for one company. */
export async function companyDto(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: companies.id,
      name: companies.name,
      phone: companies.phoneE164,
      website: companies.website,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt
    })
    .from(companies)
    .where(and(eq(companies.id, id), isNull(companies.deletedAt)))
    .limit(1);
  if (!r) throw new AppError('NOT_FOUND');
  return r;
}

/** Runs inside withServiceTenant. */
export async function listServiceCompanies(tx: Tx, svc: ServiceContext, q: CompanyListQuery) {
  const page = await listCompanies(
    sysCtx(svc),
    { q: q.q ? plainNote(q.q) : undefined, limit: q.limit, offset: q.offset },
    { tx }
  );
  return page.items.map((r) => ({
    id: r.id,
    name: r.name,
    website: r.website,
    contactCount: r.contactCount,
    dealCount: r.dealCount
  }));
}

/** Runs inside withServiceTenant. */
export async function createServiceCompany(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const input = parseInput(createCompanySchema, body);
  const clean = { ...input, name: plainNote(input.name) };
  const row = await createCompany(sysCtx(svc), clean, { tx });
  return companyDto(tx, row.id);
}

/** Runs inside withServiceTenant. Only the fields sent change. */
export async function updateServiceCompany(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  const patch = parseInput(updateCompanySchema, body);
  if (Object.keys(patch).length === 0) throw new ValidationError({ '': ['empty'] });
  await companyDto(tx, id);
  const clean = patch.name === undefined ? patch : { ...patch, name: plainNote(patch.name) };
  await updateCompany(sysCtx(svc), id, clean, { tx });
  return { data: await companyDto(tx, id), fields: Object.keys(patch) };
}

/** Runs inside withServiceTenant. Soft delete; contacts and deals stay and lose the link. */
export async function deleteServiceCompany(tx: Tx, svc: ServiceContext, id: string) {
  await companyDto(tx, id);
  await deleteCompany(sysCtx(svc), id, { tx });
  return { id, deleted: true as const };
}

/** Runs inside withServiceTenant. Contacts carry no phone or email here. */
export async function getServiceCompanyDetail(tx: Tx, svc: ServiceContext, id: string) {
  const detail = await getCompanyDetail(sysCtx(svc), id, { tx });
  return {
    company: await companyDto(tx, id),
    rollup: detail.rollup,
    contacts: detail.contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.status
    })),
    deals: detail.deals
  };
}
