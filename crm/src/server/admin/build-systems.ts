import { asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type Db } from '../db/client';
import { clientBuildSystems, tenants } from '../db/schema';
import { AppError } from '../errors';
import {
  withPlatform,
  withTenant,
  type PlatformContext,
  type TenantContextInput
} from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { pgCode } from '../db/pg-error';

export const BUILD_STAGES = ['planned', 'building', 'testing', 'live'] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

export type BuildSystem = {
  key: string;
  name: string;
  outcome: string | null;
  stage: BuildStage;
  note: string | null;
  sortOrder: number;
};

/** The phase a client is in, derived so it cannot disagree with the systems. Before go-live only. */
export type BuildPhase = 'building' | 'testing';

/** Testing once nothing is still planned or being built; otherwise Building. */
export function derivePhase(systems: readonly Pick<BuildSystem, 'stage'>[]): BuildPhase {
  if (systems.length === 0) return 'building';
  return systems.every((s) => s.stage === 'testing' || s.stage === 'live') ? 'testing' : 'building';
}

export const saveBuildSystemSchema = z.strictObject({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/),
  name: z.string().trim().min(1).max(120),
  outcome: z.string().trim().max(500).optional(),
  stage: z.enum(BUILD_STAGES),
  note: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional()
});
export type SaveBuildSystem = z.input<typeof saveBuildSystemSchema>;

/** The five systems for AA Auto Body, as a starting point staff can load and edit. */
export const AUTO_BODY_SYSTEMS: readonly Omit<SaveBuildSystem, 'stage' | 'note'>[] = [
  {
    key: 'never_miss_a_lead',
    name: 'Never Miss a Lead',
    outcome: 'Every call and text is answered, day or night, and lands in your leads list.',
    sortOrder: 1
  },
  {
    key: 'close_more_jobs',
    name: 'Close More Jobs',
    outcome: 'Quotes get followed up until they say yes or no.',
    sortOrder: 2
  },
  {
    key: 'shop_command_center',
    name: 'Shop Command Center',
    outcome: 'Jobs, quotes, calendar and the money in one place.',
    sortOrder: 3
  },
  {
    key: 'happy_customers_reviews',
    name: 'Happy Customers and Reviews',
    outcome: 'Every customer gets the review link.',
    sortOrder: 4
  },
  {
    key: 'get_found',
    name: 'Get Found',
    outcome: 'Your Google listing and online presence stay up to date.',
    sortOrder: 5
  }
];

function mapError(err: unknown): unknown {
  switch (pgCode(err)) {
    case '42501':
      return new AppError('FORBIDDEN', { cause: err });
    case 'P0002':
      return new AppError('NOT_FOUND', { cause: err });
    case '22023':
    case '23514':
      return new AppError('VALIDATION_FAILED', { cause: err });
    default:
      return err;
  }
}

type Row = {
  system_key: string;
  name: string;
  outcome: string | null;
  stage: BuildStage;
  note: string | null;
  sort_order: number;
};

/** Staff view of a client's systems. */
export async function listBuildSystems(
  ctx: PlatformContext,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<BuildSystem[]> {
  parseInput(uuidSchema, tenantId);
  try {
    const rows = await withPlatform(
      ctx,
      (tx) => tx.execute<Row>(sql`select * from admin_list_build_systems(${tenantId}::uuid)`),
      { db: opts.db ?? getDb() }
    );
    return Array.from(rows).map((r) => ({
      key: r.system_key,
      name: r.name,
      outcome: r.outcome,
      stage: r.stage,
      note: r.note,
      sortOrder: r.sort_order
    }));
  } catch (err) {
    throw mapError(err);
  }
}

/** Admin only. Adds or updates one system. */
export async function saveBuildSystem(
  ctx: PlatformContext,
  tenantId: string,
  input: unknown,
  opts: { db?: Db } = {}
): Promise<void> {
  parseInput(uuidSchema, tenantId);
  const v = parseInput(saveBuildSystemSchema, input);
  try {
    await withPlatform(
      ctx,
      (tx) =>
        tx.execute(
          sql`select admin_save_build_system(${tenantId}::uuid, ${v.key}, ${v.name}, ${v.outcome ?? null}, ${v.stage}, ${v.note ?? null}, ${v.sortOrder ?? 0})`
        ),
      { db: opts.db ?? getDb() }
    );
  } catch (err) {
    throw mapError(err);
  }
}

export async function removeBuildSystem(
  ctx: PlatformContext,
  tenantId: string,
  key: string,
  opts: { db?: Db } = {}
): Promise<void> {
  parseInput(uuidSchema, tenantId);
  try {
    await withPlatform(
      ctx,
      (tx) => tx.execute(sql`select admin_remove_build_system(${tenantId}::uuid, ${key})`),
      { db: opts.db ?? getDb() }
    );
  } catch (err) {
    throw mapError(err);
  }
}

/** What the owner sees: the tenant's own rows, read-only through row-level security. */
export async function loadBuildSystems(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<BuildSystem[]> {
  const rows = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({
          key: clientBuildSystems.systemKey,
          name: clientBuildSystems.name,
          outcome: clientBuildSystems.outcome,
          stage: clientBuildSystems.stage,
          note: clientBuildSystems.note,
          sortOrder: clientBuildSystems.sortOrder
        })
        .from(clientBuildSystems)
        .orderBy(asc(clientBuildSystems.sortOrder), asc(clientBuildSystems.name)),
    { db: opts.db ?? getDb() }
  );
  return rows.map((r) => ({ ...r, stage: r.stage as BuildStage }));
}

export type ClientBuildState = {
  phase: BuildPhase;
  systems: BuildSystem[];
};

/**
 * Whether the owner sees the build portal instead of the working pages. Only a client that has not gone
 * live (still onboarding, no go-live time) and has at least one system listed is in the build view, so
 * every existing client, and every new one until staff add systems, keeps today's portal unchanged.
 */
export async function loadClientBuildState(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<ClientBuildState | null> {
  const [tenantRows, systems] = await Promise.all([
    withTenant(
      ctx,
      (tx) =>
        tx.select({ status: tenants.status, goLiveAt: tenants.goLiveAt }).from(tenants).limit(1),
      { db: opts.db ?? getDb() }
    ),
    loadBuildSystems(ctx, opts)
  ]);
  const t = tenantRows[0];
  if (!t || t.status !== 'onboarding' || t.goLiveAt !== null || systems.length === 0) return null;
  return { phase: derivePhase(systems), systems };
}

/** Pages a client can open while their portal is still being built. */
export const BUILD_ALLOWED_PREFIXES = [
  '/dashboard/build',
  '/dashboard/help',
  '/dashboard/settings',
  '/dashboard/notifications'
] as const;

export function isAllowedDuringBuild(path: string): boolean {
  const clean = path.split('?')[0] ?? path;
  return BUILD_ALLOWED_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`));
}
