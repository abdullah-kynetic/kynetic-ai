import { randomBytes } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { recordConsent } from '../consent';
import { getDb, getWorkerDb, type Db } from '../db/client';
import { contacts, dealContacts, deals, pipelineStages, pipelines, tenants } from '../db/schema';
import { AppError, errorResponse } from '../errors';
import { emitEvent } from '../events';
import { ModuleDisabledError, moduleDisabledResponse, requireModule } from '../modules';
import { readTenantSecret, writeTenantSecret } from '../secrets';
import { clientIp } from '../security/with-api';
import {
  consumeRateLimit,
  enforceRateLimit,
  RATE_LIMITS,
  type RateLimitRule
} from '../security/rate-limit';
import { RateLimitedError } from '../errors';
import { recordActivity } from '../activity';
import { withTenant } from '../tenancy';
import { parseInput } from '../validation';
import { ingestWebhook, registerWebhookProcessor } from '../webhooks';
import { LEAD_BODY_MAX_BYTES, leadPayloadSchema, type LeadPayload } from './payload';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyLeadSignature } from './signature';

// F-76. `POST /api/hooks/leads/:tenantKey`. The tenant key is the tenant id (DC-073): an identifier,
// not a secret. The signature is the credential, so a leaked key alone gets a 401 and writes nothing.

export const LEAD_WEBHOOK_SOURCE = 'lead_webhook';
export const LEAD_SECRET = { provider: 'lead_webhook', name: 'signing_secret' } as const;

/** Per-IP cap that runs before the signature is checked, so unsigned floods cannot burn a tenant's own cap. */
export const LEAD_WEBHOOK_IP_RULE: RateLimitRule = {
  name: 'lead_webhook_ip',
  limit: 120,
  windowSeconds: 60
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unauthenticated = () => new AppError('UNAUTHENTICATED', { message: 'Invalid signature.' });

/**
 * Creates (or rotates) the tenant's signing secret. The raw value is returned once and stored
 * encrypted; rotating replaces it, so the old value stops working at once.
 */
export async function issueLeadWebhookSecret(
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<string> {
  const secret = randomBytes(32).toString('base64url');
  await writeTenantSecret(opts.db ?? getWorkerDb(), { tenantId, ...LEAD_SECRET }, secret);
  return secret;
}

export type LeadIntakeOpts = {
  db?: Db;
  workerDb?: Db;
  now?: Date;
  validate?: (input: unknown) => LeadPayload;
};

/** The route body. Throws AppError for 401, 400 and 429; returns the Response otherwise. */
export async function handleLeadIntake(
  request: Request,
  tenantKey: string,
  opts: LeadIntakeOpts = {}
): Promise<Response> {
  const db = opts.db ?? getDb();
  const workerDb = opts.workerDb ?? getWorkerDb();
  const now = opts.now ?? new Date();

  // 1. Unauthenticated cap, per client IP.
  const ip = await consumeRateLimit(db, LEAD_WEBHOOK_IP_RULE, clientIp(request), now);
  if (!ip.allowed) throw new RateLimitedError(ip.retryAfterSeconds);

  // 2. Raw body first, size-capped. Signature before anything is parsed or stored.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > LEAD_BODY_MAX_BYTES) throw new AppError('VALIDATION_FAILED');
  const rawBody = await request.text();
  if (rawBody.length > LEAD_BODY_MAX_BYTES) throw new AppError('VALIDATION_FAILED');

  const tenantId = UUID.test(tenantKey) ? tenantKey.toLowerCase() : null;
  const secret = tenantId ? await readTenantSecret(workerDb, { tenantId, ...LEAD_SECRET }) : null;
  const verified = verifyLeadSignature({
    // An unknown tenant still runs the full comparison against a throwaway key.
    secret: secret ?? randomBytes(32).toString('base64url'),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    rawBody,
    now
  });
  if (!tenantId || !secret || !verified) throw unauthenticated();

  // 3. Authenticated from here: per-tenant cap, module gate, then validation.
  await enforceRateLimit(db, RATE_LIMITS.leadWebhookTenant, tenantId, now);
  try {
    await requireModule({ tenantId, role: 'system' }, 'alex_core', { db: workerDb });
  } catch (e) {
    if (e instanceof ModuleDisabledError) return moduleDisabledResponse(e);
    throw e;
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new AppError('VALIDATION_FAILED', { fieldErrors: { '': ['invalid_json'] } });
  }
  const lead = opts.validate ? opts.validate(json) : parseInput(leadPayloadSchema, json);

  // 4. Store once, queue the processing. (source, external_id) is unique across all tenants, so the
  // tenant id is part of the external id.
  const result = await ingestWebhook(
    {
      source: LEAD_WEBHOOK_SOURCE,
      externalId: `${tenantId}:${lead.source}:${lead.externalId}`,
      tenantId,
      payload: lead,
      verify: () => true
    },
    { db }
  );
  return Response.json(
    { ok: true, data: { status: result.status === 'duplicate' ? 'duplicate' : 'accepted' } },
    { status: 200 }
  );
}

/** Wraps handleLeadIntake with the standard error body. */
export async function leadIntakeResponse(request: Request, tenantKey: string): Promise<Response> {
  try {
    return await handleLeadIntake(request, tenantKey);
  } catch (e) {
    return errorResponse(e);
  }
}

function displayName(lead: LeadPayload): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  return name || lead.phone || lead.email || 'Unknown';
}

/** Kanban order key for a new card: later cards sort after earlier ones (DC-074). */
function positionKey(now: Date): string {
  return `t${now.getTime().toString(36).padStart(9, '0')}`;
}

/**
 * Runs in the worker: one contact (reused when the phone or email already exists), one deal in the
 * default pipeline's first stage, an activity, any consent the form carried, and `lead.created`.
 * All in one transaction, so a retry never leaves half a lead.
 */
export async function processLead(
  tenantId: string,
  lead: LeadPayload,
  webhookEventId: string,
  opts: { db?: Db; now?: Date } = {}
): Promise<{ contactId: string; dealId: string; contactReused: boolean }> {
  const db = opts.db ?? getWorkerDb();
  const now = opts.now ?? new Date();
  const ctx = { tenantId, role: 'system' as const };
  await requireModule(ctx, 'alex_core', { db });

  return withTenant(
    ctx,
    async (tx) => {
      const [tenant] = await tx.select({ timezone: tenants.timezone }).from(tenants).limit(1);
      const [stage] = await tx
        .select({ pipelineId: pipelines.id, stageId: pipelineStages.id })
        .from(pipelines)
        .innerJoin(pipelineStages, eq(pipelineStages.pipelineId, pipelines.id))
        .where(
          and(
            eq(pipelines.isDefault, true),
            eq(pipelineStages.isWon, false),
            eq(pipelineStages.isLost, false)
          )
        )
        .orderBy(asc(pipelineStages.position))
        .limit(1);
      if (!stage) throw new Error('Tenant has no default pipeline with an open stage');

      const match = [
        lead.phone ? sql`${lead.phone} = ANY(${contacts.phones})` : undefined,
        lead.email ? sql`${lead.email} = ANY(${contacts.emails})` : undefined
      ].filter((c) => c !== undefined);
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId),
            sql`(${sql.join(match, sql` or `)})`
          )
        )
        .limit(1);

      let contactId = existing?.id;
      if (!contactId) {
        const [created] = await tx
          .insert(contacts)
          .values({
            tenantId,
            firstName: lead.firstName ?? displayName(lead),
            lastName: lead.lastName ?? null,
            primaryPhoneE164: lead.phone ?? null,
            primaryEmail: lead.email ?? null,
            phones: lead.phone ? [lead.phone] : [],
            emails: lead.email ? [lead.email] : [],
            address: lead.address ?? {},
            timezone: tenant?.timezone ?? null,
            source: lead.source,
            status: 'new'
          })
          .returning({ id: contacts.id });
        contactId = created!.id;
      }

      const [deal] = await tx
        .insert(deals)
        .values({
          tenantId,
          pipelineId: stage.pipelineId,
          stageId: stage.stageId,
          title: `${lead.serviceType ?? 'New lead'} - ${displayName(lead)}`.slice(0, 200),
          serviceType: lead.serviceType ?? null,
          source: lead.source,
          position: positionKey(now)
        })
        .returning({ id: deals.id });
      const dealId = deal!.id;
      await tx.insert(dealContacts).values({ tenantId, dealId, contactId, role: 'homeowner' });

      if (lead.consent) {
        for (const channel of lead.consent.channels) {
          await recordConsent(
            ctx,
            {
              contactId,
              channel,
              source: 'form',
              capturedText: lead.consent.capturedText,
              wordingVersion: lead.consent.wordingVersion,
              ip: lead.consent.ip,
              capturedAt: lead.consent.capturedAt ? new Date(lead.consent.capturedAt) : undefined
            },
            { tx }
          );
        }
      }

      await recordActivity(tx, {
        contactId,
        dealId,
        type: 'system',
        summary: `New lead from ${lead.source}`,
        actor: { type: 'system' },
        meta: {
          source: lead.source,
          externalId: lead.externalId,
          ...(lead.synthetic ? { synthetic: true, businessState: lead.businessState } : {}),
          ...(lead.projectType ? { projectType: lead.projectType } : {}),
          ...(lead.budget ? { budget: lead.budget } : {}),
          ...(lead.message ? { message: lead.message } : {}),
          ...(existing ? { contactReused: true } : {})
        }
      });

      await emitEvent(tx, {
        name: 'lead.created',
        tenantId,
        actor: { type: 'system' },
        payload: {
          contactId,
          dealId,
          source: lead.source,
          webhookEventId,
          ...(lead.synthetic
            ? {
                synthetic: true,
                businessState: lead.businessState,
                projectType: lead.projectType,
                budget: lead.budget
              }
            : {})
        }
      });
      return { contactId, dealId, contactReused: !!existing };
    },
    { db }
  );
}

/** Registers the worker-side processor for stored lead webhooks. Call once from the worker entry. */
export function registerLeadProcessor(): void {
  registerWebhookProcessor(LEAD_WEBHOOK_SOURCE, async (event) => {
    if (!event.tenantId) throw new Error('Lead webhook event has no tenant');
    const lead = leadPayloadSchema.parse(event.payload);
    await processLead(event.tenantId, lead, event.id);
  });
}
