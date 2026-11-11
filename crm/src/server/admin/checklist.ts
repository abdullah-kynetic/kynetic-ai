import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { getDb, type Db } from '../db/client';
import { onboardingSteps, tenantModules } from '../db/schema';
import { AppError } from '../errors';
import { MODULE_KEYS } from '../modules';
import {
  withPlatform,
  withTenant,
  type PlatformContext,
  type TenantContextInput
} from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { buildChecklist } from './onboarding-steps';

export const STEP_STATUSES = ['todo', 'doing', 'blocked', 'done', 'n/a'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** A checklist row as the admin sees it: every step, with owner, due date and the internal note. */
export type AdminChecklistStep = {
  stepKey: string;
  title: string;
  moduleKey: string | null;
  clientVisible: boolean;
  status: StepStatus;
  ownerUserId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  doneAt: string | null;
  note: string | null;
};

export type AdminChecklist = {
  steps: AdminChecklistStep[];
  /** Null until an admin marks the client live. */
  goLiveAt: string | null;
  /** Steps other than go-live that are not done or n/a; go-live is allowed at zero. */
  openCount: number;
};

/** Display order: the template order, with unknown keys (a hand-added step) last. */
const STEP_ORDER = new Map(buildChecklist(MODULE_KEYS).map((s, i) => [s.stepKey, i] as const));
const orderOf = (key: string) => STEP_ORDER.get(key) ?? STEP_ORDER.size;

type Row = {
  step_key: string;
  title: string;
  module_key: string | null;
  client_visible: boolean;
  status: StepStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  due_date: string | null;
  done_at: string | Date | null;
  note: string | null;
  go_live_at: string | Date | null;
};

const iso = (v: string | Date | null) => (v === null ? null : new Date(v).toISOString());

function pgCode(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** The roll-up functions raise 42501 for the wrong role and P0002 for a missing tenant or step. */
function mapDbError(err: unknown): unknown {
  switch (pgCode(err)) {
    case '42501':
      return new AppError('FORBIDDEN', { cause: err });
    case 'P0002':
      return new AppError('NOT_FOUND', { cause: err });
    case '22023':
    case '22P02':
    case '22007':
    case '23503':
      return new AppError('VALIDATION_FAILED', { cause: err });
    case '55000':
      return new AppError('CONFLICT', { message: 'This client is already live.', cause: err });
    case '23514':
      return new AppError('CONFLICT', {
        message: 'Finish or skip every other step before marking the client live.',
        cause: err
      });
    default:
      return err;
  }
}

const stepKey = z.string().trim().min(1).max(60);

/** Admin and VA read the whole checklist of one tenant (F-100; SECURITY: admin and VA read and write). */
export async function getAdminChecklist(
  ctx: PlatformContext,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<AdminChecklist> {
  parseInput(uuidSchema, tenantId);
  try {
    const rows = await withPlatform(
      ctx,
      (tx) => tx.execute<Row>(sql`select * from admin_list_onboarding_steps(${tenantId}::uuid)`),
      { db: opts.db ?? getDb() }
    );
    const steps = rows
      .map((r): AdminChecklistStep => ({
        stepKey: r.step_key,
        title: r.title,
        moduleKey: r.module_key,
        clientVisible: r.client_visible,
        status: r.status,
        ownerUserId: r.owner_user_id,
        ownerName: r.owner_name,
        dueDate: r.due_date,
        doneAt: iso(r.done_at),
        note: r.note
      }))
      .toSorted((a, b) => orderOf(a.stepKey) - orderOf(b.stepKey));
    return {
      steps,
      goLiveAt: rows[0] ? iso(rows[0].go_live_at) : null,
      openCount: steps.filter(
        (s) => s.stepKey !== 'go_live' && s.status !== 'done' && s.status !== 'n/a'
      ).length
    };
  } catch (err) {
    throw mapDbError(err);
  }
}

export const updateStepSchema = z
  .object({
    status: z.enum(STEP_STATUSES).optional(),
    ownerUserId: z.uuid().nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    note: z.string().trim().max(2000).nullable().optional()
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'empty_patch' });
export type StepPatch = z.input<typeof updateStepSchema>;

/** Updates one step. Admin and VA only; the function stamps `done_at` and writes the audit row. */
export async function updateChecklistStep(
  ctx: PlatformContext,
  tenantId: string,
  key: string,
  patch: StepPatch,
  opts: { db?: Db } = {}
): Promise<void> {
  parseInput(uuidSchema, tenantId);
  parseInput(stepKey, key);
  const p = parseInput(updateStepSchema, patch);
  const json: Record<string, unknown> = {};
  if (p.status !== undefined) json.status = p.status;
  if (p.ownerUserId !== undefined) json.owner_user_id = p.ownerUserId;
  if (p.dueDate !== undefined) json.due_date = p.dueDate;
  if (p.note !== undefined) json.note = p.note ?? '';
  try {
    await withPlatform(
      ctx,
      (tx) =>
        tx.execute(
          sql`select update_onboarding_step(${tenantId}::uuid, ${key}, ${JSON.stringify(json)}::jsonb)`
        ),
      { db: opts.db ?? getDb() }
    );
  } catch (err) {
    throw mapDbError(err);
  }
}

/** Marks the client live: every other step done or n/a. Admin only. Returns the go-live time. */
export async function markGoLive(
  ctx: PlatformContext,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<string> {
  parseInput(uuidSchema, tenantId);
  try {
    const [row] = await withPlatform(
      ctx,
      (tx) =>
        tx.execute<{ at: string | Date }>(sql`select mark_tenant_go_live(${tenantId}::uuid) as at`),
      { db: opts.db ?? getDb() }
    );
    return new Date(row!.at).toISOString();
  } catch (err) {
    throw mapDbError(err);
  }
}

/** Adds template steps for the currently enabled systems without changing existing checklist work. */
export async function regenerateChecklist(
  ctx: PlatformContext,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<number> {
  parseInput(uuidSchema, tenantId);
  if (ctx.role !== 'admin') throw new AppError('FORBIDDEN');
  return withTenant(
    { tenantId, userId: ctx.userId, role: 'admin' },
    async (tx) => {
      const rows = await tx
        .select({ moduleKey: tenantModules.moduleKey })
        .from(tenantModules)
        .where(eq(tenantModules.enabled, true));
      const enabled = rows
        .map((row) => row.moduleKey)
        .filter((key): key is (typeof MODULE_KEYS)[number] =>
          MODULE_KEYS.includes(key as (typeof MODULE_KEYS)[number])
        );
      const template = buildChecklist(['platform', ...enabled]);
      const inserted = await tx
        .insert(onboardingSteps)
        .values(
          template.map((step) => ({
            tenantId,
            stepKey: step.stepKey,
            title: step.title,
            moduleKey: step.moduleKey,
            clientVisible: step.clientVisible,
            status: step.doneAtCreation ? 'done' : 'todo',
            doneAt: step.doneAtCreation ? new Date().toISOString() : null
          }))
        )
        .onConflictDoNothing({ target: [onboardingSteps.tenantId, onboardingSteps.stepKey] })
        .returning({ id: onboardingSteps.id });
      await audit(tx, {
        action: 'checklist.regenerate',
        entity: 'tenant',
        entityId: tenantId,
        after: { inserted: inserted.length, modules: enabled }
      });
      return inserted.length;
    },
    { db: opts.db ?? getDb() }
  );
}

export type SetupState = 'done' | 'doing' | 'waiting';
export type SetupProgress = {
  steps: { title: string; state: SetupState }[];
  done: number;
  total: number;
};

const STATE: Record<StepStatus, SetupState | null> = {
  done: 'done',
  doing: 'doing',
  todo: 'waiting',
  blocked: 'waiting',
  'n/a': null
};

/**
 * What the owner sees on the dashboard until go-live (F-100): client-visible steps only, with a state
 * and no owner, date or note. Returns null once the client is live. The database policy also hides
 * internal steps from owner and staff; the column list here keeps the rest out of the payload.
 */
export async function loadSetupProgress(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<SetupProgress | null> {
  const rows = await withTenant(
    ctx,
    (tx) =>
      tx.execute<{
        step_key: string;
        title: string;
        status: StepStatus;
        go_live_at: string | Date | null;
      }>(sql`
        select s.step_key, s.title, s.status, t.go_live_at
          from onboarding_steps s join tenants t on t.id = s.tenant_id
         where s.client_visible`),
    { db: opts.db ?? getDb() }
  );
  if (rows.length === 0 || rows[0]!.go_live_at !== null) return null;
  const steps = rows
    .toSorted((a, b) => orderOf(a.step_key) - orderOf(b.step_key))
    .flatMap((r) => {
      const state = STATE[r.status];
      return state ? [{ title: r.title, state }] : [];
    });
  return { steps, done: steps.filter((s) => s.state === 'done').length, total: steps.length };
}
