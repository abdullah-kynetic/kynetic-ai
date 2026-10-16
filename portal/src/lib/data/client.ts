import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { businessProfiles, clients, contacts, documents, milestones, scopeItems } from "../db/schema";
import { withScope } from "../db/scoped";
import { clientScope, type ClientSession } from "../auth/session";
import { signedFileUrl } from "../files";
import { loadResults } from "./results";

/*
 * Client-facing reads. Every function takes the server-resolved ClientSession — never an id from the
 * request — and filters by s.clientId explicitly. RLS (client scope) enforces the same rule in Postgres.
 */

export async function getClient(s: ClientSession) {
  return withScope(clientScope(s), async (tx) => {
    const [c] = await tx.select({ id: clients.id, name: clients.name, status: clients.status, planName: clients.planName, includedMinutes: clients.includedMinutes })
      .from(clients).where(eq(clients.id, s.clientId));
    return c ?? null;
  });
}

export async function getProfile(s: ClientSession) {
  return withScope(clientScope(s), async (tx) => {
    const [p] = await tx.select().from(businessProfiles).where(eq(businessProfiles.clientId, s.clientId));
    return p ?? null;
  });
}

export async function listContacts(s: ClientSession) {
  return withScope(clientScope(s), (tx) =>
    tx.select({ id: contacts.id, name: contacts.name, title: contacts.title, email: contacts.email, phone: contacts.phone, isPrimary: contacts.isPrimary })
      .from(contacts).where(eq(contacts.clientId, s.clientId)).orderBy(desc(contacts.isPrimary), asc(contacts.name)));
}

export async function listScope(s: ClientSession) {
  return withScope(clientScope(s), (tx) =>
    tx.select({ id: scopeItems.id, title: scopeItems.title, description: scopeItems.description, status: scopeItems.status })
      .from(scopeItems).where(eq(scopeItems.clientId, s.clientId)).orderBy(asc(scopeItems.sort), asc(scopeItems.createdAt)));
}

export async function listMilestones(s: ClientSession) {
  return withScope(clientScope(s), (tx) =>
    tx.select({ id: milestones.id, phase: milestones.phase, title: milestones.title, description: milestones.description, dueDate: milestones.dueDate, status: milestones.status, completedAt: milestones.completedAt })
      .from(milestones).where(eq(milestones.clientId, s.clientId)).orderBy(asc(milestones.sort), asc(milestones.dueDate)));
}

/** Uploader identity is reduced to "Kynetic" / "You" / "Your team" — clients never see other users' names or emails. */
export async function listDocuments(s: ClientSession) {
  const rows = await withScope(clientScope(s), (tx) =>
    tx.select({ id: documents.id, name: documents.name, category: documents.category, mime: documents.mime, size: documents.size, createdAt: documents.createdAt, uploadedBy: documents.uploadedBy, uploadedByRole: documents.uploadedByRole })
      .from(documents).where(eq(documents.clientId, s.clientId)).orderBy(desc(documents.createdAt)));
  return rows.map(({ uploadedBy, uploadedByRole, ...d }) => ({
    ...d,
    uploader: uploadedByRole === "admin" ? "Kynetic" : uploadedBy === s.userId ? "You" : "Your team",
    url: signedFileUrl(d.id, s.userId),
  }));
}

export async function getResults(s: ClientSession, days = 30) {
  return withScope(clientScope(s), async (tx) => {
    const [c] = await tx.select({ includedMinutes: clients.includedMinutes }).from(clients).where(eq(clients.id, s.clientId));
    if (!c) return null;
    return loadResults(tx, s.clientId, c.includedMinutes, days);
  });
}

/** One document belonging to the caller's tenant, or null (used by the download route). */
export async function findClientDocument(s: ClientSession, docId: string) {
  return withScope(clientScope(s), async (tx) => {
    const [d] = await tx.select().from(documents).where(and(eq(documents.id, docId), eq(documents.clientId, s.clientId)));
    return d ?? null;
  });
}
