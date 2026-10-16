import "server-only";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { businessProfiles, clients, contacts, dailyResults, documents, ingestKeys, milestones, scopeItems, users, auditLog } from "../db/schema";
import { withScope } from "../db/scoped";
import { adminScope, type AdminSession } from "../auth/session";
import { signedFileUrl, isUuid } from "../files";
import { loadResults } from "./results";

/* Admin reads. Callers must have passed requireAdmin() (role + MFA). Runs in admin scope. */

// In a single-table select Drizzle renders `${clients.id}` unqualified ("id"), which inside a correlated
// subquery silently binds to the subquery's own table. Always qualify explicitly.
const CLIENT_ID = sql.raw('"clients"."id"');

export async function listClients(s: AdminSession) {
  return withScope(adminScope(s), async (tx) => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    return tx.select({
      id: clients.id, name: clients.name, slug: clients.slug, status: clients.status, planName: clients.planName, createdAt: clients.createdAt,
      users: sql<number>`(select count(*)::int from ${users} u where u.client_id = ${CLIENT_ID})`,
      docs: sql<number>`(select count(*)::int from ${documents} d where d.client_id = ${CLIENT_ID})`,
      leads30: sql<number>`(select coalesce(sum(r.leads),0)::int from ${dailyResults} r where r.client_id = ${CLIENT_ID} and r.date >= ${since})`,
      bookings30: sql<number>`(select coalesce(sum(r.bookings),0)::int from ${dailyResults} r where r.client_id = ${CLIENT_ID} and r.date >= ${since})`,
      lastResult: sql<string | null>`(select max(r.date)::text from ${dailyResults} r where r.client_id = ${CLIENT_ID})`,
    }).from(clients).orderBy(asc(clients.name));
  });
}

export async function getClientDetail(s: AdminSession, clientId: string) {
  if (!isUuid(clientId)) return null;
  return withScope(adminScope(s), async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return null;
    const [profile] = await tx.select().from(businessProfiles).where(eq(businessProfiles.clientId, clientId));
    const [contactRows, scopeRows, milestoneRows, docRows, userRows, keyRows] = await Promise.all([
      tx.select().from(contacts).where(eq(contacts.clientId, clientId)).orderBy(desc(contacts.isPrimary), asc(contacts.name)),
      tx.select().from(scopeItems).where(eq(scopeItems.clientId, clientId)).orderBy(asc(scopeItems.sort), asc(scopeItems.createdAt)),
      tx.select().from(milestones).where(eq(milestones.clientId, clientId)).orderBy(asc(milestones.sort), asc(milestones.dueDate)),
      tx.select({ id: documents.id, name: documents.name, category: documents.category, mime: documents.mime, size: documents.size, createdAt: documents.createdAt, uploadedByRole: documents.uploadedByRole, uploaderEmail: users.email })
        .from(documents).leftJoin(users, eq(users.id, documents.uploadedBy)).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt)),
      tx.select({ id: users.id, email: users.email, name: users.name, lastLoginAt: users.lastLoginAt, disabledAt: users.disabledAt, hasPassword: sql<boolean>`${users.passwordHash} is not null`, createdAt: users.createdAt })
        .from(users).where(and(eq(users.clientId, clientId), eq(users.role, "client"))).orderBy(asc(users.email)),
      tx.select({ id: ingestKeys.id, prefix: ingestKeys.prefix, label: ingestKeys.label, lastUsedAt: ingestKeys.lastUsedAt, revokedAt: ingestKeys.revokedAt, createdAt: ingestKeys.createdAt })
        .from(ingestKeys).where(eq(ingestKeys.clientId, clientId)).orderBy(desc(ingestKeys.createdAt)),
    ]);
    // Sequential: results loader shares the transaction.
    const results = await loadResults(tx, clientId, client.includedMinutes, 30);
    return {
      client, profile: profile ?? null, contacts: contactRows, scope: scopeRows, milestones: milestoneRows,
      documents: docRows.map((d) => ({ ...d, url: signedFileUrl(d.id, s.userId) })),
      users: userRows, keys: keyRows, results,
    };
  });
}

export async function recentActivity(s: AdminSession, limit = 25) {
  return withScope(adminScope(s), (tx) =>
    tx.select({ id: auditLog.id, action: auditLog.action, createdAt: auditLog.createdAt, clientName: clients.name, actorEmail: users.email, meta: auditLog.meta })
      .from(auditLog).leftJoin(clients, eq(clients.id, auditLog.clientId)).leftJoin(users, eq(users.id, auditLog.actorUserId))
      .orderBy(desc(auditLog.createdAt)).limit(limit));
}

export async function adminFindDocument(s: AdminSession, docId: string) {
  return withScope(adminScope(s), async (tx) => {
    const [d] = await tx.select().from(documents).where(eq(documents.id, docId));
    return d ?? null;
  });
}

export async function activeKeyCount(s: AdminSession, clientId: string) {
  return withScope(adminScope(s), async (tx) => {
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(ingestKeys).where(and(eq(ingestKeys.clientId, clientId), isNull(ingestKeys.revokedAt)));
    return r?.n ?? 0;
  });
}

export async function portfolioTotals(s: AdminSession) {
  return withScope(adminScope(s), async (tx) => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const [r] = await tx.select({
      leads: sql<number>`coalesce(sum(${dailyResults.leads}),0)::int`, calls: sql<number>`coalesce(sum(${dailyResults.calls}),0)::int`,
      bookings: sql<number>`coalesce(sum(${dailyResults.bookings}),0)::int`, minutes: sql<number>`coalesce(sum(${dailyResults.minutesUsed}),0)::float`,
    }).from(dailyResults).where(gte(dailyResults.date, since));
    return r;
  });
}
