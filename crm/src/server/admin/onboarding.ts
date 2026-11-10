import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { EmailProvider } from '../adapters/email/types';
import { getDb, type Db, type Tx } from '../db/client';
import { onboardingSteps, tenants } from '../db/schema';
import { audit } from '../audit';
import { AppError, ValidationError } from '../errors';
import { MODULE_KEYS, type ModuleKey } from '../modules';
import { withPlatform, type PlatformContext } from '../tenancy';
import { FIELD_LIMITS, parseInput } from '../validation';
import { INDUSTRY_TEMPLATES, INDUSTRY_TEMPLATE_KEYS } from './industry-templates';
import { applyStageDefaults } from './templates';
import { buildChecklist } from './onboarding-steps';

/** Invite lifetime (SECURITY 2.1: 7 days). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Modules the form can switch on. `platform` is always on and `crm` is chosen by level. */
export const ONBOARD_MODULE_KEYS = MODULE_KEYS.filter(
  (k): k is Exclude<ModuleKey, 'platform' | 'crm'> => k !== 'platform' && k !== 'crm'
);

/** E.164 from what an admin types: `+` numbers pass through, 10 digits and 1 plus 10 digits are US. */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, '');
  const e164 = t.startsWith('+')
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith('1')
        ? `+${digits}`
        : null;
  return e164 && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const onboardTenantSchema = z
  .object({
    businessName: z.string().trim().min(1).max(FIELD_LIMITS.name),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{3,40}$/)
      .optional(),
    ownerEmail: z.email().max(254),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        const e164 = normalizePhone(v);
        if (!e164) ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
        return e164 ?? '';
      }),
    industry: z.enum(INDUSTRY_TEMPLATE_KEYS),
    timezone: z.string().refine(validTimezone),
    hours: z
      .object({
        days: z.array(z.enum(DAYS)).min(1),
        open: time,
        close: time
      })
      .refine((h) => h.open < h.close),
    serviceZips: z
      .array(z.string().regex(/^\d{5}$/))
      .max(500)
      .default([]),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    logoUrl: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .optional(),
    plan: z.enum(['founding', 'value']),
    tier: z.enum(['T1', 'T2', 'T3']).optional(),
    modules: z.array(z.enum(ONBOARD_MODULE_KEYS)).default([]),
    crmLevel: z.enum(['lite', 'full']).optional()
  })
  .strict();

export type OnboardTenantInput = z.input<typeof onboardTenantSchema>;

/** Turning the bundle on turns its three members on (PRD F-84). */
export function expandModules(
  modules: readonly Exclude<ModuleKey, 'platform' | 'crm'>[]
): Exclude<ModuleKey, 'platform' | 'crm'>[] {
  const set = new Set(modules);
  if (set.has('followup_bundle')) {
    for (const m of ['quote_followup', 'reactivation', 'missed_call_textback'] as const) set.add(m);
  }
  return ONBOARD_MODULE_KEYS.filter((k) => set.has(k));
}

export type OnboardDeps = {
  db?: Db;
  now?: Date;
  /** Test seam: runs inside the transaction right after the tenant exists, so a failure here must leave nothing behind. */
  afterTenantCreated?: (tx: Tx) => Promise<void>;
};

export type OnboardResult = { tenantId: string; slug: string; ownerEmail: string };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

function pgCode(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** The roll-up functions raise 42501 for a non-admin and P0002 for a missing tenant. */
function mapDbError(err: unknown): unknown {
  const code = pgCode(err);
  if (code === '42501') return new AppError('FORBIDDEN', { cause: err });
  if (code === 'P0002') return new AppError('NOT_FOUND', { cause: err });
  return err;
}

/**
 * The 30-second onboarding form (F-55): one transaction creates the tenant with its default pipeline and
 * Alex draft (`create_tenant`), the owner invite, the module rows, the business profile and the checklist,
 * and writes the audit rows. Any failure rolls everything back. No email is sent here: the invite goes out
 * only when an admin approves it (`sendOwnerInvite`). The caller must already have passed `admin.onboard`.
 */
export async function onboardTenant(
  ctx: PlatformContext,
  raw: unknown,
  deps: OnboardDeps = {}
): Promise<OnboardResult> {
  const input = parseInput(onboardTenantSchema, raw);
  const slug = input.slug ?? slugify(input.businessName);
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    throw new ValidationError({ slug: ['invalid_string'] });
  }
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const modules = expandModules(input.modules);
  const now = deps.now ?? new Date();
  const dayHours = { open: input.hours.open, close: input.hours.close };
  const businessHours = Object.fromEntries(
    DAYS.map((d) => [d, input.hours.days.includes(d) ? dayHours : null])
  );
  const enabled: ModuleKey[] = [
    'platform',
    ...modules,
    ...(input.crmLevel ? (['crm'] as const) : [])
  ];
  const template = INDUSTRY_TEMPLATES[input.industry];

  try {
    return await withPlatform(
      ctx,
      async (tx) => {
        const [taken] = await tx.execute<{ taken: boolean }>(
          sql`select owner_email_in_use(${ownerEmail}) as taken`
        );
        if (taken?.taken) {
          throw new AppError('CONFLICT', {
            message: 'That email already has an account or a pending invite.',
            fieldErrors: { ownerEmail: ['in_use'] }
          });
        }

        const token = newToken();
        const expires = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
        const [created] = await tx.execute<{ id: string }>(
          sql`select create_tenant(${slug}, ${input.businessName}, ${input.plan}, ${input.timezone}, ${ownerEmail}, ${hashToken(token)}, ${expires}::timestamptz) as id`
        );
        const tenantId = created!.id;
        await deps.afterTenantCreated?.(tx);

        for (const m of modules) {
          await tx.execute(sql`select set_tenant_module(${tenantId}::uuid, ${m}, true, '')`);
        }
        if (input.crmLevel) {
          await tx.execute(
            sql`select set_tenant_module(${tenantId}::uuid, 'crm', true, ${input.crmLevel})`
          );
        }
        if (input.tier) {
          await tx.execute(
            sql`select admin_update_tenant_commercial(${tenantId}::uuid, ${JSON.stringify({ pricing_tier: input.tier })}::jsonb)`
          );
        }

        // `create_tenant` leaves the new tenant as the transaction's tenant, so these run under its RLS.
        await tx
          .update(tenants)
          .set({
            businessHours,
            serviceArea: { zips: input.serviceZips },
            services: [...template.services],
            transferNumberE164: input.phone,
            primaryColor: input.primaryColor ?? null,
            logoUrl: input.logoUrl ?? null
          })
          .where(eq(tenants.id, tenantId));

        await tx.insert(onboardingSteps).values(
          buildChecklist(enabled).map((s) => ({
            tenantId,
            stepKey: s.stepKey,
            title: s.title,
            moduleKey: s.moduleKey,
            clientVisible: s.clientVisible,
            status: s.doneAtCreation ? 'done' : 'todo',
            doneAt: s.doneAtCreation ? now.toISOString() : null
          }))
        );

        const stages = await applyStageDefaults(
          { tenantId, userId: ctx.userId, role: 'admin' },
          tx,
          template.stages
        );
        await audit(tx, {
          action: 'tenant.onboard',
          entity: 'tenant',
          entityId: tenantId,
          after: {
            slug,
            plan: input.plan,
            tier: input.tier ?? null,
            industry: input.industry,
            modules: enabled,
            crmLevel: input.crmLevel ?? null,
            stages
          }
        });
        return { tenantId, slug, ownerEmail };
      },
      { db: deps.db ?? getDb() }
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (pgCode(err) === '23505') {
      throw new AppError('CONFLICT', {
        message: 'A client with this web address already exists. Change the address and try again.',
        fieldErrors: { slug: ['in_use'] },
        cause: err
      });
    }
    throw mapDbError(err);
  }
}

export type SendInviteDeps = {
  db?: Db;
  now?: Date;
  email: EmailProvider;
  baseUrl: string;
  fromAddress: string;
};

/** The owner invite as the admin reviews it before approving. The sign-in link is added when it is sent. */
export function draftOwnerInvite(businessName: string): { subject: string; body: string } {
  return {
    subject: `Your ${businessName} portal is ready`,
    body: `Hi,\n\nYour Kynetic portal for ${businessName} is set up. Use the link below to sign in and finish getting started. The link works once and expires in 7 days.\n\n[Sign-in link added when sent]\n\nKynetic AI`
  };
}

/**
 * Approve and send (F-55, F-104: nothing customer-facing goes out unapproved). Issues a fresh single-use
 * token, revokes the earlier one, marks the checklist step done, and emails the owner on record. The token
 * is hashed in the database and never logged. The caller must already have passed `admin.onboard`.
 */
export async function sendOwnerInvite(
  ctx: PlatformContext,
  tenantId: string,
  deps: SendInviteDeps
): Promise<{ providerId: string }> {
  z.uuid().parse(tenantId);
  const now = deps.now ?? new Date();
  const token = newToken();
  const expires = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
  const issued = await withPlatform(
    ctx,
    async (tx) => {
      const [row] = await tx.execute<{ owner_email: string; tenant_name: string }>(
        sql`select owner_email, tenant_name from reissue_owner_invite(${tenantId}::uuid, ${hashToken(token)}, ${expires}::timestamptz)`
      );
      return row!;
    },
    { db: deps.db ?? getDb() }
  ).catch((err: unknown) => {
    throw mapDbError(err);
  });

  const draft = draftOwnerInvite(issued.tenant_name);
  const link = `${deps.baseUrl.replace(/\/$/, '')}/sign-in?invite=${encodeURIComponent(token)}`;
  return deps.email.send({
    tenantId,
    to: issued.owner_email,
    fromName: 'Kynetic AI',
    fromAddress: deps.fromAddress,
    subject: draft.subject,
    html: `<p>${draft.body.split('\n\n').slice(0, 2).join('</p><p>')}</p><p><a href="${link}">Open your portal</a></p>`,
    text: draft.body.replace('[Sign-in link added when sent]', link),
    idempotencyKey: `owner-invite:${tenantId}:${hashToken(token).slice(0, 16)}`
  });
}
