import { and, eq, isNull, sql } from 'drizzle-orm';
import { isIP } from 'node:net';
import { audit } from '../audit';
import { authorize, ForbiddenError, type AuthUser } from '../auth';
import { getDb, type Db, type Tx } from '../db/client';
import * as schema from '../db/schema';
import { AppError, RateLimitedError, ValidationError } from '../errors';
import { enforceRateLimit, RATE_LIMITS } from '../security/rate-limit';
import { withPlatform, withTenant, type TenantContextInput } from '../tenancy';
import {
  evaluateSession,
  formatCookie,
  parseCookie,
  reasonSchema,
  VIEW_AS,
  type Viewer
} from './evaluate';

// View as client (F-57, SECURITY 2.6). The session row in impersonation_sessions is the source of
// truth; the cookie only says which row to look at. Every call re-reads the row under the claimed
// tenant's RLS context, so a forged cookie finds nothing, and re-checks the live Kynetic role.

export type ViewAsUser = Pick<AuthUser, 'id' | 'kyneticRole' | 'twoFactor'>;
export type ViewAsDeps = { db?: Db; now?: Date };
export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export type ActiveViewAs = {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  /** Effective mode: true unless an admin has an unexpired write window. */
  readOnly: boolean;
  writeUntil: Date | null;
  startedAt: Date;
  /** The context for tenant reads (and writes, in write mode) during this session. */
  ctx: TenantContextInput;
};

export type ViewAsState = { kind: 'none' } | ({ kind: 'active' } & ActiveViewAs);

const ip = (meta: RequestMeta) => (meta.ip && isIP(meta.ip) ? meta.ip : undefined);

function staffOnly(user: ViewAsUser): asserts user is ViewAsUser & { kyneticRole: 'admin' | 'va' } {
  if (user.twoFactor !== 'verified' || !user.kyneticRole) throw new ForbiddenError();
  authorize(
    { userId: user.id, kyneticRole: user.kyneticRole, membership: null, viewAs: null },
    'viewas.start'
  );
}

function sessionCtx(user: ViewAsUser & { kyneticRole: 'admin' | 'va' }, tenantId: string) {
  // The Kynetic user is the actor and the impersonator, so audit rows carry both (F-57).
  return {
    tenantId,
    userId: user.id,
    role: user.kyneticRole,
    impersonatorId: user.id,
    readOnly: false
  } satisfies TenantContextInput;
}

function checkReason(reason: unknown): string {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success)
    throw new ValidationError({ reason: parsed.error.issues.map((i) => i.message) });
  return parsed.data;
}

const asDate = (v: string | null) => (v ? new Date(v) : null);

type Row = typeof schema.impersonationSessions.$inferSelect;

async function loadRow(tx: Tx, sessionId: string, tenantId: string): Promise<Row | undefined> {
  const [row] = await tx
    .select()
    .from(schema.impersonationSessions)
    .where(
      and(
        eq(schema.impersonationSessions.id, sessionId),
        eq(schema.impersonationSessions.tenantId, tenantId)
      )
    )
    .limit(1);
  return row;
}

function viewerOf(user: ViewAsUser): Viewer {
  return { id: user.id, kyneticRole: user.kyneticRole, twoFactor: user.twoFactor };
}

function decide(row: Row, user: ViewAsUser, now: Date) {
  return evaluateSession(
    {
      impersonatorUserId: row.impersonatorUserId,
      readOnly: row.readOnly,
      endedAt: asDate(row.endedAt),
      lastSeenAt: new Date(row.lastSeenAt),
      writeUntil: asDate(row.writeUntil)
    },
    viewerOf(user),
    now
  );
}

/**
 * Starts a session. Needs a reason, TOTP-verified staff, and no session already open in this browser
 * (impersonation does not nest). Starts are limited per user (SECURITY 5.4); a refused start is
 * audited so repeated attempts are visible.
 */
export async function startViewAs(
  input: {
    user: ViewAsUser;
    tenantId: string;
    reason: unknown;
    activeCookie?: string;
    meta?: RequestMeta;
  },
  deps: ViewAsDeps = {}
): Promise<{ sessionId: string; cookie: string }> {
  const { user } = input;
  staffOnly(user);
  const db = deps.db ?? getDb();
  const now = deps.now ?? new Date();
  const reason = checkReason(input.reason);
  const meta = input.meta ?? {};

  const existing = await resolveViewAs({ user, cookie: input.activeCookie, touch: false }, deps);
  if (existing.kind === 'active')
    throw new AppError('CONFLICT', {
      message: 'Exit the current view-as session before starting another.'
    });

  try {
    await enforceRateLimit(db, RATE_LIMITS.impersonationStart, user.id, now);
  } catch (err) {
    if (err instanceof RateLimitedError)
      await withPlatform(
        { userId: user.id, role: user.kyneticRole },
        (tx) =>
          audit(tx, {
            action: 'viewas.rate_limited',
            entity: 'impersonation_session',
            after: { tenantId: input.tenantId },
            ip: ip(meta),
            userAgent: meta.userAgent ?? undefined
          }),
        { db }
      );
    throw err;
  }

  return withTenant(
    sessionCtx(user, input.tenantId),
    async (tx) => {
      const [tenant] = await tx
        .select({ id: schema.tenants.id, status: schema.tenants.status })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, input.tenantId))
        .limit(1);
      if (!tenant || tenant.status === 'offboarded') throw new AppError('NOT_FOUND');
      const [row] = await tx
        .insert(schema.impersonationSessions)
        .values({
          tenantId: input.tenantId,
          impersonatorUserId: user.id,
          readOnly: true,
          startedAt: now.toISOString(),
          lastSeenAt: now.toISOString(),
          reason,
          ip: ip(meta) ?? null,
          userAgent: meta.userAgent ?? null
        })
        .returning({ id: schema.impersonationSessions.id });
      await audit(tx, {
        action: 'viewas.start',
        entity: 'impersonation_session',
        entityId: row.id,
        after: { reason, readOnly: true },
        ip: ip(meta),
        userAgent: meta.userAgent ?? undefined
      });
      return { sessionId: row.id, cookie: formatCookie(row.id, input.tenantId) };
    },
    { db }
  );
}

/**
 * The current session for a request, or none. With `touch` (the default) it also records the
 * request: last-seen time for the idle expiry and one audit row carrying tenant and impersonator.
 * Idle and role-loss end the session; an expired write window drops back to read-only.
 */
export async function resolveViewAs(
  input: { user: ViewAsUser; cookie: string | undefined; touch?: boolean },
  deps: ViewAsDeps = {}
): Promise<ViewAsState> {
  const { user } = input;
  const ref = parseCookie(input.cookie);
  if (!ref || !user.kyneticRole) return { kind: 'none' };
  const staff = user as ViewAsUser & { kyneticRole: 'admin' | 'va' };
  const now = deps.now ?? new Date();

  return withTenant(
    sessionCtx(staff, ref.tenantId),
    async (tx): Promise<ViewAsState> => {
      const row = await loadRow(tx, ref.sessionId, ref.tenantId);
      if (!row) return { kind: 'none' };
      const decision = decide(row, user, now);
      if (decision.kind === 'invalid') return { kind: 'none' };
      if (decision.kind === 'end') {
        await closeRow(tx, row, decision.reason, now);
        return { kind: 'none' };
      }
      if (decision.writeLapsed) {
        await tx
          .update(schema.impersonationSessions)
          .set({ readOnly: true })
          .where(eq(schema.impersonationSessions.id, row.id));
        await audit(tx, {
          action: 'viewas.write_expired',
          entity: 'impersonation_session',
          entityId: row.id
        });
      }
      if (input.touch ?? true) {
        await tx
          .update(schema.impersonationSessions)
          .set({ lastSeenAt: now.toISOString() })
          .where(eq(schema.impersonationSessions.id, row.id));
        await audit(tx, {
          action: 'viewas.request',
          entity: 'impersonation_session',
          entityId: row.id
        });
      }
      const [tenant] = await tx
        .select({ name: schema.tenants.name })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, ref.tenantId))
        .limit(1);
      return {
        kind: 'active',
        sessionId: row.id,
        tenantId: ref.tenantId,
        tenantName: tenant?.name ?? 'Unknown business',
        readOnly: decision.readOnly,
        writeUntil: decision.readOnly ? null : asDate(row.writeUntil),
        startedAt: new Date(row.startedAt),
        ctx: { ...sessionCtx(staff, ref.tenantId), readOnly: decision.readOnly }
      };
    },
    { db: deps.db }
  );
}

async function closeRow(tx: Tx, row: Row, reason: string, now: Date): Promise<void> {
  await tx
    .update(schema.impersonationSessions)
    .set({ endedAt: now.toISOString(), endedReason: reason })
    .where(
      and(eq(schema.impersonationSessions.id, row.id), isNull(schema.impersonationSessions.endedAt))
    );
  await audit(tx, {
    action: 'viewas.end',
    entity: 'impersonation_session',
    entityId: row.id,
    after: { reason }
  });
}

/** Ends the caller's own session. Safe to call twice, and for a cookie that no longer matches. */
export async function endViewAs(
  input: { user: ViewAsUser; cookie: string | undefined },
  deps: ViewAsDeps = {}
): Promise<boolean> {
  const { user } = input;
  const ref = parseCookie(input.cookie);
  if (!ref || !user.kyneticRole) return false;
  const staff = user as ViewAsUser & { kyneticRole: 'admin' | 'va' };
  const now = deps.now ?? new Date();
  return withTenant(
    sessionCtx(staff, ref.tenantId),
    async (tx) => {
      const row = await loadRow(tx, ref.sessionId, ref.tenantId);
      if (!row || row.endedAt || row.impersonatorUserId !== user.id) return false;
      await closeRow(tx, row, 'exit', now);
      return true;
    },
    { db: deps.db }
  );
}

/**
 * Admin only: switches the open session to write mode for 30 minutes, with a second reason.
 * A VA is refused and the attempt is audited (SEC-T-11). The forbidden actions of SECURITY 2.6
 * (export, users, modules, billing, Alex prompt, send as client) stay closed in write mode through
 * `can()`, not here.
 */
export async function enableWriteMode(
  input: { user: ViewAsUser; cookie: string | undefined; reason: unknown },
  deps: ViewAsDeps = {}
): Promise<{ writeUntil: Date }> {
  const { user } = input;
  staffOnly(user);
  const ref = parseCookie(input.cookie);
  if (!ref) throw new AppError('NOT_FOUND');
  const now = deps.now ?? new Date();

  if (user.kyneticRole !== 'admin') {
    await withTenant(
      sessionCtx(user, ref.tenantId),
      (tx) =>
        audit(tx, {
          action: 'viewas.write_denied',
          entity: 'impersonation_session',
          entityId: ref.sessionId
        }),
      { db: deps.db }
    ).catch(() => undefined);
    throw new ForbiddenError();
  }
  const reason = checkReason(input.reason);

  return withTenant(
    sessionCtx(user, ref.tenantId),
    async (tx) => {
      const row = await loadRow(tx, ref.sessionId, ref.tenantId);
      if (!row || decide(row, user, now).kind !== 'active') throw new AppError('NOT_FOUND');
      if (!row.readOnly && row.writeUntil && new Date(row.writeUntil) > now)
        throw new AppError('CONFLICT', { message: 'Write mode is already on for this session.' });
      const writeUntil = new Date(now.getTime() + VIEW_AS.writeMs);
      await tx
        .update(schema.impersonationSessions)
        .set({ readOnly: false, writeReason: reason, writeUntil: writeUntil.toISOString() })
        .where(eq(schema.impersonationSessions.id, row.id));
      await audit(tx, {
        action: 'viewas.write_enable',
        entity: 'impersonation_session',
        entityId: row.id,
        after: { reason, writeUntil: writeUntil.toISOString() }
      });
      return { writeUntil };
    },
    { db: deps.db }
  );
}

/** Back to read-only before the window runs out. */
export async function disableWriteMode(
  input: { user: ViewAsUser; cookie: string | undefined },
  deps: ViewAsDeps = {}
): Promise<void> {
  const { user } = input;
  staffOnly(user);
  const ref = parseCookie(input.cookie);
  if (!ref) return;
  const now = deps.now ?? new Date();
  await withTenant(
    sessionCtx(user, ref.tenantId),
    async (tx) => {
      const row = await loadRow(tx, ref.sessionId, ref.tenantId);
      if (!row || row.readOnly || decide(row, user, now).kind !== 'active') return;
      await tx
        .update(schema.impersonationSessions)
        .set({ readOnly: true, writeReason: null, writeUntil: null })
        .where(eq(schema.impersonationSessions.id, row.id));
      await audit(tx, {
        action: 'viewas.write_disable',
        entity: 'impersonation_session',
        entityId: row.id
      });
    },
    { db: deps.db }
  );
}

export type ViewAsTenant = { id: string; name: string; status: string };

/**
 * The clients a Kynetic user may start a session for. Names and status only, through the roll-up
 * function (SECURITY 2.3.6); no tenant rows are opened until a session starts.
 */
export async function listViewAsTenants(
  user: ViewAsUser,
  deps: Pick<ViewAsDeps, 'db'> = {}
): Promise<ViewAsTenant[]> {
  staffOnly(user);
  const rows = await withPlatform(
    { userId: user.id, role: user.kyneticRole },
    (tx) =>
      tx.execute<{ tenant_id: string; name: string; status: string }>(
        sql`select tenant_id, name, status from admin_tenant_overview()`
      ),
    { db: deps.db }
  );
  return rows
    .filter((r) => r.status !== 'offboarded')
    .map((r) => ({ id: r.tenant_id, name: r.name, status: r.status }));
}
