import { count, isNotNull, isNull } from 'drizzle-orm';
import { contacts, deals } from '@/server/db/schema';
import { errorResponse } from '@/server/errors';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';

export const GET = withServiceAuth(async (_request, svc) => {
  try {
    const data = await withServiceTenant(svc, async (tx) => {
      const [contactCount] = await tx.select({ count: count() }).from(contacts).where(isNull(contacts.deletedAt));
      const [dealCount] = await tx.select({ count: count() }).from(deals).where(isNull(deals.deletedAt));
      const [wonCount] = await tx.select({ count: count() }).from(deals).where(isNotNull(deals.wonAt));
      return { contacts: contactCount?.count ?? 0, deals: dealCount?.count ?? 0, wonDeals: wonCount?.count ?? 0 };
    });
    return Response.json({ ok: true, data });
  } catch (error) { return errorResponse(error); }
}, { requiredScope: 'read-kpi' });

