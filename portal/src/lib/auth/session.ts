import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { users } from "../db/schema";
import { withScope, type Scope } from "../db/scoped";

export type PortalSession = {
  userId: string;
  email: string;
  name: string | null;
  role: "admin" | "client";
  clientId: string | null;
  totpEnabled: boolean;
  needsMfaSetup: boolean;
};
export type ClientSession = PortalSession & { role: "client"; clientId: string };
export type AdminSession = PortalSession & { role: "admin" };

const ADMIN_MAX_AGE_SEC = 12 * 60 * 60;

/**
 * The single source of truth for "who is calling". The JWT only proves a user id + session version;
 * role, client and status are re-read from the DB every request so revocation is immediate.
 */
export const getSession = cache(async (): Promise<PortalSession | null> => {
  const s = (await auth()) as { uid?: string; sv?: number; iat?: number } | null;
  if (!s?.uid) return null;
  const [u] = await withScope({ role: "system" }, (tx) => tx.select().from(users).where(eq(users.id, s.uid!)).limit(1));
  if (!u || u.disabledAt || u.sessionVersion !== s.sv) return null;
  if (u.role === "client" && !u.clientId) return null;
  if (u.role === "admin" && s.iat && Date.now() / 1000 - s.iat > ADMIN_MAX_AGE_SEC) return null;
  return {
    userId: u.id, email: u.email, name: u.name, role: u.role, clientId: u.role === "client" ? u.clientId : null,
    totpEnabled: u.totpEnabled, needsMfaSetup: u.role === "admin" && !u.totpEnabled,
  };
});

export async function requireUser(): Promise<PortalSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** For client-facing pages. Admins are sent to /admin. */
export async function requireClient(): Promise<ClientSession> {
  const s = await requireUser();
  if (s.role === "admin") redirect("/admin");
  return s as ClientSession;
}

/** For admin pages/actions. Non-admins get a 404 (no existence oracle). Admins without MFA go to setup. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await requireUser();
  if (s.role !== "admin") notFound();
  if (s.needsMfaSetup) redirect("/mfa/setup");
  return s as AdminSession;
}

export const clientScope = (s: ClientSession): Scope => ({ role: "client", userId: s.userId, clientId: s.clientId });
export const adminScope = (s: AdminSession): Scope => ({ role: "admin", userId: s.userId });
