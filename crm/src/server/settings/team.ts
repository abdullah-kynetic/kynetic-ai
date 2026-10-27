import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { invitations, memberships, users } from '../db/schema';
import { AppError } from '../errors';
import { can, type Actor } from '../auth/permissions';
import { audit } from '../audit';
import { withTenant, type TenantContextInput } from '../tenancy';
import { emailSchema, parseInput, uuidSchema } from '../validation';

const INVITE_DAYS = 14;

function requireTeamManage(actor: Actor, tenantId: string) {
  if (!can(actor, 'team.manage', tenantId)) throw new AppError('FORBIDDEN');
}

export type TeamMember = {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'staff';
  canExport: boolean;
  canBulkDelete: boolean;
};

export type PendingInvite = { id: string; email: string; role: 'staff'; expiresAt: string };

/** Staff cannot open team settings (F-41, TESTING): reads are gated like writes. */
export async function listTeam(
  ctx: TenantContextInput,
  actor: Actor,
  opts: { db?: Db; now?: Date } = {}
): Promise<{ members: TeamMember[]; invites: PendingInvite[] }> {
  requireTeamManage(actor, ctx.tenantId);
  return withTenant(
    ctx,
    async (tx) => {
      const members = await tx
        .select({
          userId: memberships.userId,
          email: users.email,
          name: users.name,
          role: memberships.role,
          canExport: memberships.canExport,
          canBulkDelete: memberships.canBulkDelete
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.tenantId, ctx.tenantId))
        .orderBy(memberships.createdAt);
      const invites = await tx
        .select({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt })
        .from(invitations)
        .where(
          and(
            eq(invitations.tenantId, ctx.tenantId),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
            gt(invitations.expiresAt, (opts.now ?? new Date()).toISOString())
          )
        )
        .orderBy(desc(invitations.createdAt));
      return {
        members: members as TeamMember[],
        invites: invites.map((i) => ({ ...i, role: 'staff' as const }))
      };
    },
    opts
  );
}

export const inviteStaffSchema = z.object({ email: emailSchema }).strict();

/**
 * Invites a staff member. Only staff can be invited here; owners are created by Kynetic onboarding.
 * Returns the raw token once for the email; only its hash is stored (SECURITY invites).
 */
export async function inviteStaff(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  opts: { db?: Db; now?: Date } = {}
): Promise<{ id: string; token: string; expiresAt: string }> {
  requireTeamManage(actor, ctx.tenantId);
  const { email } = parseInput(inviteStaffSchema, input);
  const now = opts.now ?? new Date();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString();
  return withTenant(
    ctx,
    async (tx) => {
      const [member] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.tenantId, ctx.tenantId), eq(users.email, email)));
      if (member)
        throw new AppError('CONFLICT', { message: 'That person is already on your team.' });
      const [open] = await tx
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.tenantId, ctx.tenantId),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
            gt(invitations.expiresAt, now.toISOString())
          )
        );
      if (open)
        throw new AppError('CONFLICT', { message: 'That person already has an open invite.' });
      const [row] = await tx
        .insert(invitations)
        .values({
          tenantId: ctx.tenantId,
          email,
          role: 'staff',
          tokenHash: createHash('sha256').update(token).digest('hex'),
          invitedBy: ctx.userId ?? null,
          expiresAt
        })
        .returning({ id: invitations.id });
      await audit(tx, {
        action: 'team.invite',
        entity: 'invitation',
        entityId: row.id,
        after: { email, role: 'staff' }
      });
      return { id: row.id, token, expiresAt };
    },
    opts
  );
}

export async function revokeInvite(
  ctx: TenantContextInput,
  actor: Actor,
  inviteId: string,
  opts: { db?: Db } = {}
): Promise<void> {
  requireTeamManage(actor, ctx.tenantId);
  const id = parseInput(uuidSchema, inviteId);
  await withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .update(invitations)
        .set({ revokedAt: new Date().toISOString() })
        .where(
          and(
            eq(invitations.id, id),
            eq(invitations.tenantId, ctx.tenantId),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt)
          )
        )
        .returning({ email: invitations.email });
      if (rows.length === 0) throw new AppError('NOT_FOUND');
      await audit(tx, {
        action: 'team.invite_revoke',
        entity: 'invitation',
        entityId: id,
        before: { email: rows[0].email }
      });
    },
    opts
  );
}

export const staffPermissionsSchema = z
  .object({ canExport: z.boolean(), canBulkDelete: z.boolean() })
  .partial()
  .strict();

/** Owner toggles a staff member's export and bulk-delete permissions (F-73). */
export async function setStaffPermissions(
  ctx: TenantContextInput,
  actor: Actor,
  userId: string,
  input: unknown,
  opts: { db?: Db } = {}
): Promise<void> {
  requireTeamManage(actor, ctx.tenantId);
  const uid = parseInput(uuidSchema, userId);
  const patch = parseInput(staffPermissionsSchema, input);
  await withTenant(
    ctx,
    async (tx) => {
      const where = and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.userId, uid),
        eq(memberships.role, 'staff')
      );
      const [before] = await tx
        .select({ canExport: memberships.canExport, canBulkDelete: memberships.canBulkDelete })
        .from(memberships)
        .where(where);
      if (!before) throw new AppError('NOT_FOUND');
      const [after] = await tx
        .update(memberships)
        .set(patch)
        .where(where)
        .returning({ canExport: memberships.canExport, canBulkDelete: memberships.canBulkDelete });
      await audit(tx, {
        action: 'team.permissions',
        entity: 'membership',
        entityId: uid,
        before,
        after
      });
    },
    opts
  );
}

/** Removes a staff member. Owners are never removed here, so a tenant cannot lose its last owner. */
export async function removeStaff(
  ctx: TenantContextInput,
  actor: Actor,
  userId: string,
  opts: { db?: Db } = {}
): Promise<void> {
  requireTeamManage(actor, ctx.tenantId);
  const uid = parseInput(uuidSchema, userId);
  await withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .delete(memberships)
        .where(
          and(
            eq(memberships.tenantId, ctx.tenantId),
            eq(memberships.userId, uid),
            eq(memberships.role, 'staff')
          )
        )
        .returning({ userId: memberships.userId });
      if (rows.length === 0) throw new AppError('NOT_FOUND');
      await audit(tx, { action: 'team.remove', entity: 'membership', entityId: uid });
    },
    opts
  );
}
