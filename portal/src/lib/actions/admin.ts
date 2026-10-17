"use server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { businessProfiles, clients, contacts, documents, ingestKeys, milestones, scopeItems, users } from "../db/schema";
import { withScope } from "../db/scoped";
import { adminScope, requireAdmin } from "../auth/session";
import { issueToken } from "../auth/tokens";
import { emails, sendEmail } from "../email";
import { env } from "../env";
import { audit } from "../audit";
import { randomToken, sha256 } from "../crypto";
import { storage } from "../storage";

/*
 * Admin mutations. Every action: requireAdmin() (role + MFA) → zod-validate → admin scope → audit.
 * Return shape is ActionState so forms can use useActionState.
 */
export type ActionState = { ok?: boolean; error?: string; message?: string; secret?: string } | undefined;

const uuid = z.string().uuid();
const opt = (max = 500) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const fail = (e: z.ZodError): ActionState => ({ error: e.issues[0]?.message ?? "Invalid input." });
const obj = (fd: FormData) => Object.fromEntries(fd.entries());
const back = (clientId: string) => revalidatePath(`/admin/clients/${clientId}`, "layout");

// ---- Clients ------------------------------------------------------------------------------------

const clientInput = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  status: z.enum(["onboarding", "active", "paused"]).default("onboarding"),
  planName: z.string().trim().max(60).default("Plan 1"),
  includedMinutes: z.coerce.number().int().min(0).max(1_000_000).default(1200),
  twentyCompanyId: opt(64),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "client";

export async function createClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = clientInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const id = await withScope(adminScope(s), async (tx) => {
    const slug = `${slugify(p.data.name)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const [c] = await tx.insert(clients).values({ ...p.data, slug }).returning({ id: clients.id });
    await tx.insert(businessProfiles).values({ clientId: c.id, legalName: p.data.name });
    const phases = [["kickoff", "Kickoff call"], ["build", "Build agents & automations"], ["testing", "Testing & QA"], ["go_live", "Go-live"]] as const;
    await tx.insert(milestones).values(phases.map(([phase, title], i) => ({ clientId: c.id, phase, title, sort: i })));
    await audit(tx, { actorUserId: s.userId, clientId: c.id, action: "client.created", meta: { name: p.data.name } });
    return c.id;
  });
  revalidatePath("/admin");
  redirect(`/admin/clients/${id}`);
}

export async function updateClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = uuid.safeParse(fd.get("clientId"));
  const p = clientInput.safeParse(obj(fd));
  if (!id.success) return { error: "Invalid client." };
  if (!p.success) return fail(p.error);
  await withScope(adminScope(s), async (tx) => {
    await tx.update(clients).set({ ...p.data, updatedAt: new Date() }).where(eq(clients.id, id.data));
    await audit(tx, { actorUserId: s.userId, clientId: id.data, action: "client.updated" });
  });
  back(id.data);
  return { ok: true, message: "Client saved." };
}

const profileInput = z.object({
  clientId: uuid, legalName: opt(200), industry: opt(120), website: opt(300), phone: opt(60), address: opt(300),
  serviceArea: opt(300), hours: opt(300), notes: opt(4000),
});

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = profileInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { clientId, ...data } = p.data;
  await withScope(adminScope(s), async (tx) => {
    await tx.insert(businessProfiles).values({ clientId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: businessProfiles.clientId, set: { ...data, updatedAt: new Date() } });
    await audit(tx, { actorUserId: s.userId, clientId, action: "profile.updated" });
  });
  back(clientId);
  return { ok: true, message: "Profile saved." };
}

// ---- Contacts / scope / milestones (generic upsert + delete, always keyed by BOTH id and clientId) --

const contactInput = z.object({
  clientId: uuid, id: uuid.optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Name is required.").max(120), title: opt(120),
  email: z.string().trim().max(254).email("Invalid email.").optional().or(z.literal("").transform(() => null)),
  phone: opt(60), isPrimary: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = contactInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { id, clientId, ...data } = p.data;
  await withScope(adminScope(s), async (tx) => {
    if (data.isPrimary) await tx.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, clientId));
    if (id) await tx.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.clientId, clientId)));
    else await tx.insert(contacts).values({ clientId, ...data, email: data.email ?? null });
    await audit(tx, { actorUserId: s.userId, clientId, action: id ? "contact.updated" : "contact.created" });
  });
  back(clientId);
  return { ok: true, message: "Contact saved." };
}

const scopeInput = z.object({
  clientId: uuid, id: uuid.optional().or(z.literal("").transform(() => undefined)),
  title: z.string().trim().min(1, "Title is required.").max(200), description: opt(2000),
  status: z.enum(["planned", "in_progress", "done"]).default("planned"), sort: z.coerce.number().int().min(0).max(10000).default(0),
});

export async function saveScopeItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = scopeInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { id, clientId, ...data } = p.data;
  await withScope(adminScope(s), async (tx) => {
    if (id) await tx.update(scopeItems).set(data).where(and(eq(scopeItems.id, id), eq(scopeItems.clientId, clientId)));
    else await tx.insert(scopeItems).values({ clientId, ...data });
    await audit(tx, { actorUserId: s.userId, clientId, action: id ? "scope.updated" : "scope.created" });
  });
  back(clientId);
  return { ok: true, message: "Scope item saved." };
}

const milestoneInput = z.object({
  clientId: uuid, id: uuid.optional().or(z.literal("").transform(() => undefined)),
  phase: z.enum(["kickoff", "build", "testing", "go_live"]), title: z.string().trim().min(1, "Title is required.").max(200),
  description: opt(2000), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => null)),
  status: z.enum(["upcoming", "in_progress", "done"]).default("upcoming"), sort: z.coerce.number().int().min(0).max(10000).default(0),
});

export async function saveMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = milestoneInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { id, clientId, ...data } = p.data;
  const row = { ...data, dueDate: data.dueDate ?? null, completedAt: data.status === "done" ? new Date() : null };
  await withScope(adminScope(s), async (tx) => {
    if (id) await tx.update(milestones).set(row).where(and(eq(milestones.id, id), eq(milestones.clientId, clientId)));
    else await tx.insert(milestones).values({ clientId, ...row });
    await audit(tx, { actorUserId: s.userId, clientId, action: id ? "milestone.updated" : "milestone.created" });
  });
  back(clientId);
  return { ok: true, message: "Milestone saved." };
}

const delInput = z.object({ clientId: uuid, id: uuid, kind: z.enum(["contact", "scope", "milestone", "document"]) });

export async function deleteItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = delInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { clientId, id, kind } = p.data;
  let storageKey: string | null = null;
  await withScope(adminScope(s), async (tx) => {
    if (kind === "contact") await tx.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.clientId, clientId)));
    if (kind === "scope") await tx.delete(scopeItems).where(and(eq(scopeItems.id, id), eq(scopeItems.clientId, clientId)));
    if (kind === "milestone") await tx.delete(milestones).where(and(eq(milestones.id, id), eq(milestones.clientId, clientId)));
    if (kind === "document") {
      const [d] = await tx.delete(documents).where(and(eq(documents.id, id), eq(documents.clientId, clientId))).returning({ key: documents.storageKey });
      storageKey = d?.key ?? null;
    }
    await audit(tx, { actorUserId: s.userId, clientId, action: `${kind}.deleted`, meta: { id } });
  });
  if (storageKey) await storage().remove(storageKey).catch(() => {});
  back(clientId);
  return { ok: true, message: "Deleted." };
}

// ---- Users --------------------------------------------------------------------------------------

const inviteInput = z.object({ clientId: uuid, email: z.string().trim().toLowerCase().email("Invalid email.").max(254), name: opt(120) });

export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = inviteInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { clientId, email, name } = p.data;
  const res = await withScope(adminScope(s), async (tx) => {
    const [c] = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId));
    if (!c) return { error: "Client not found." } as const;
    const [existing] = await tx.select({ id: users.id, clientId: users.clientId, role: users.role }).from(users).where(sql`lower(${users.email}) = ${email}`);
    if (existing && (existing.role !== "client" || existing.clientId !== clientId)) return { error: "That email already belongs to another account." } as const;
    const userId = existing?.id ?? (await tx.insert(users).values({ email, name, role: "client", clientId }).returning({ id: users.id }))[0].id;
    await audit(tx, { actorUserId: s.userId, clientId, action: "user.invited", meta: { email } });
    return { userId, clientName: c.name } as const;
  });
  if ("error" in res) return { error: res.error };
  const token = await issueToken(res.userId, "invite");
  await sendEmail({ to: email, ...emails.invite(`${env.appUrl}/invite?token=${token}`, res.clientName) });
  back(clientId);
  return { ok: true, message: env.resendApiKey ? `Invite sent to ${email}.` : `Invite created for ${email} (email stub: link is in the server log).` };
}

const userToggleInput = z.object({ clientId: uuid, userId: uuid, disable: z.enum(["true", "false"]) });

export async function setUserDisabled(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = userToggleInput.safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const { clientId, userId, disable } = p.data;
  await withScope(adminScope(s), async (tx) => {
    await tx.update(users).set({ disabledAt: disable === "true" ? new Date() : null, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, userId), eq(users.clientId, clientId), eq(users.role, "client")));
    await audit(tx, { actorUserId: s.userId, clientId, action: disable === "true" ? "user.disabled" : "user.enabled", meta: { userId } });
  });
  back(clientId);
  return { ok: true, message: disable === "true" ? "User disabled and signed out." : "User re-enabled." };
}

// ---- Ingest keys --------------------------------------------------------------------------------

/** Creates a key and returns the raw secret ONCE (only its sha256 is stored). */
export async function createIngestKey(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = z.object({ clientId: uuid, label: z.string().trim().min(1).max(60).default("n8n") }).safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  const prefix = randomToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).padEnd(8, "x");
  const secret = randomToken(32);
  const raw = `kp_${prefix}_${secret}`;
  await withScope(adminScope(s), async (tx) => {
    await tx.insert(ingestKeys).values({ clientId: p.data.clientId, prefix, keyHash: sha256(raw), label: p.data.label });
    await audit(tx, { actorUserId: s.userId, clientId: p.data.clientId, action: "ingest_key.created", meta: { prefix } });
  });
  back(p.data.clientId);
  return { ok: true, message: "Copy this key now — it won't be shown again.", secret: raw };
}

export async function revokeIngestKey(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const p = z.object({ clientId: uuid, keyId: uuid }).safeParse(obj(fd));
  if (!p.success) return fail(p.error);
  await withScope(adminScope(s), async (tx) => {
    await tx.update(ingestKeys).set({ revokedAt: new Date() })
      .where(and(eq(ingestKeys.id, p.data.keyId), eq(ingestKeys.clientId, p.data.clientId), isNull(ingestKeys.revokedAt)));
    await audit(tx, { actorUserId: s.userId, clientId: p.data.clientId, action: "ingest_key.revoked", meta: { keyId: p.data.keyId } });
  });
  back(p.data.clientId);
  return { ok: true, message: "Key revoked." };
}
