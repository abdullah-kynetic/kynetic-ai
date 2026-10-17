import "server-only";
import { eq } from "drizzle-orm";
import { clients } from "../db/schema";
import { withScope } from "../db/scoped";
import { peekToken } from "./tokens";

// Read-only helpers for the magic-link and invite pages (server components). Not server actions.

/** Does this magic token belong to an admin with MFA (so the page should show a code field)? */
export async function magicNeedsTotp(token: string): Promise<boolean | null> {
  const p = await peekToken(token, "magic");
  if (!p) return null;
  return p.user.role === "admin" && p.user.totpEnabled;
}

/** Invite page: show who the invite is for without consuming it. Returns only what that invitee may see. */
export async function describeInvite(token: string): Promise<{ email: string; clientName: string | null } | null> {
  const p = await peekToken(token, "invite");
  if (!p) return null;
  let clientName: string | null = null;
  if (p.user.clientId) {
    const [c] = await withScope({ role: "client", userId: p.user.id, clientId: p.user.clientId }, (tx) =>
      tx.select({ name: clients.name }).from(clients).where(eq(clients.id, p.user.clientId!)));
    clientName = c?.name ?? null;
  }
  return { email: p.user.email, clientName };
}

