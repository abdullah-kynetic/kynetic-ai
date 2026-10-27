import { and, count, eq, gte, isNull } from 'drizzle-orm';
import { canContact } from '../consent';
import type { Tx } from '../db/client';
import {
  activities,
  alexConfigs,
  calls,
  contacts,
  phoneNumbers,
  tenantModules,
  tenants
} from '../db/schema';
import { getEnv } from '../env';
import { withTenant, type TenantContextInput } from '../tenancy';
import {
  CONTACT_CALL_CAPS,
  type GateDecision,
  type OutboundGateOpts,
  type OutboundRequest
} from './types';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The single guard every call and SMS passes through (CODE_STYLE, SECURITY 3.9). Feature code never
 * reaches a provider adapter without an allow from here, and a deny means no provider call.
 *
 * Checks run cheapest and most final first: global kill switch, tenant suspended, module off, Alex
 * paused (calls and texts), SMS not approved, rate caps, and last `canContact` (consent, DNC, quiet
 * hours), whose allow or deny is the one activity row a passing send writes. Every earlier deny
 * writes a "blocked: reason" activity of its own. The kill switch is read on each call, so a queued
 * job cannot slip past it.
 */
export async function checkOutbound(
  ctx: TenantContextInput,
  req: OutboundRequest,
  now: Date,
  opts: OutboundGateOpts = {}
): Promise<GateDecision> {
  const outboundEnabled = opts.outboundEnabled ?? getEnv().OUTBOUND_ENABLED;
  const body = async (tx: Tx): Promise<GateDecision> => {
    const early = await configDecision(tx, ctx, req, now, outboundEnabled, opts);
    if (early) {
      await logBlocked(tx, ctx, req, now, early);
      return early;
    }
    if (opts.replyToInbound && req.channel === 'sms') return { allowed: true };
    return canContact(ctx, req.contactId, req.channel, now, {
      tx,
      purpose: req.purpose,
      stateWindows: opts.stateWindows
    });
  };
  return opts.tx ? body(opts.tx) : withTenant(ctx, body, { db: opts.db });
}

const deny = (reason: Extract<GateDecision, { allowed: false }>['reason']): GateDecision => ({
  allowed: false,
  reason
});

async function configDecision(
  tx: Tx,
  ctx: TenantContextInput,
  req: OutboundRequest,
  now: Date,
  outboundEnabled: boolean,
  opts: OutboundGateOpts
): Promise<GateDecision | null> {
  if (!outboundEnabled) return deny('outbound_disabled');

  const [tenant] = await tx
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);
  if (!tenant || tenant.status === 'suspended' || tenant.status === 'offboarded') {
    return deny('tenant_suspended');
  }

  const [mod] = await tx
    .select({ enabled: tenantModules.enabled })
    .from(tenantModules)
    .where(and(eq(tenantModules.tenantId, ctx.tenantId), eq(tenantModules.moduleKey, req.module)))
    .limit(1);
  if (!mod?.enabled) return deny('module_off');

  if (req.channel === 'phone_call' || req.channel === 'sms') {
    const [alex] = await tx
      .select({ paused: alexConfigs.paused })
      .from(alexConfigs)
      .where(eq(alexConfigs.tenantId, ctx.tenantId))
      .limit(1);
    if (alex?.paused) return deny('alex_paused');
  }

  if (req.channel === 'sms') {
    const [approved] = await tx
      .select({ id: phoneNumbers.id })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.tenantId, ctx.tenantId),
          eq(phoneNumbers.a2PStatus, 'approved'),
          isNull(phoneNumbers.releasedAt)
        )
      )
      .limit(1);
    if (!approved) return deny('sms_not_approved');
  }

  if (req.channel === 'phone_call' && (await overCallCap(tx, ctx.tenantId, req, now, opts))) {
    return deny('rate_cap');
  }
  return null;
}

async function overCallCap(
  tx: Tx,
  tenantId: string,
  req: OutboundRequest,
  now: Date,
  opts: OutboundGateOpts
): Promise<boolean> {
  const since = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const outbound = (from: string, contactId?: string) =>
    tx
      .select({ n: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.direction, 'outbound'),
          gte(calls.startedAt, from),
          contactId ? eq(calls.contactId, contactId) : undefined
        )
      )
      .then(([row]) => row?.n ?? 0);

  if ((await outbound(since(DAY_MS), req.contactId)) >= CONTACT_CALL_CAPS.perDay) return true;
  if ((await outbound(since(7 * DAY_MS), req.contactId)) >= CONTACT_CALL_CAPS.perWeek) return true;
  const hourly = opts.tenantHourlyCallCap;
  return hourly !== undefined && (await outbound(since(HOUR_MS))) >= hourly;
}

async function logBlocked(
  tx: Tx,
  ctx: TenantContextInput,
  req: OutboundRequest,
  now: Date,
  decision: GateDecision
): Promise<void> {
  if (decision.allowed || ctx.readOnly) return;
  // A contact this tenant cannot see has nothing to hang an activity on.
  const [contact] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, req.contactId))
    .limit(1);
  if (!contact) return;
  await tx.insert(activities).values({
    tenantId: ctx.tenantId,
    contactId: req.contactId,
    type: 'system',
    summary: `blocked: ${decision.reason} (${req.channel})`,
    actorType: 'system',
    occurredAt: now.toISOString(),
    meta: {
      check: 'outbound_gate',
      channel: req.channel,
      module: req.module,
      purpose: req.purpose ?? null,
      allowed: false,
      reason: decision.reason
    }
  });
}
