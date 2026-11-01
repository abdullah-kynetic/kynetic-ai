import { and, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { contactState, STATE_RULES } from '../compliance/state-rules';
import { DEFAULT_WINDOW, isValidTimeZone } from '../consent/quiet-hours';
import { CONSENT_CHANNELS } from '../consent';
import type { Db, Tx } from '../db/client';
import {
  alexConfigs,
  calls,
  consents,
  contacts,
  dncEntries,
  phoneNumbers,
  tenantModules,
  tenants
} from '../db/schema';
import { getEnv } from '../env';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { CONTACT_CALL_CAPS } from '../outbound/types';
import { type ServiceContext, withServiceTenant } from '../service-auth';

export type PolicyOptions = { db?: Db; now?: Date; outboundEnabled?: boolean };
const platformConfig = z.object({ outbound_kill_switch: z.boolean().optional() }).passthrough();

async function sendState(tx: Tx, opts: PolicyOptions) {
  const [tenant] = await tx.select({ status: tenants.status }).from(tenants).limit(1);
  if (!tenant) throw new AppError('NOT_FOUND');
  const [platform] = await tx
    .select({ config: tenantModules.config })
    .from(tenantModules)
    .where(eq(tenantModules.moduleKey, 'platform'))
    .limit(1);
  const parsed = platformConfig.safeParse(platform?.config);
  const configurationValid = !!platform && parsed.success;
  const globalKillSwitch = !(opts.outboundEnabled ?? getEnv().OUTBOUND_ENABLED);
  const tenantKillSwitch = !configurationValid || parsed.data?.outbound_kill_switch === true;
  const tenantSuspended = tenant.status === 'suspended' || tenant.status === 'offboarded';
  const [alex] = await tx.select({ paused: alexConfigs.paused }).from(alexConfigs).limit(1);
  return {
    checkedAt: (opts.now ?? new Date()).toISOString(),
    globalKillSwitch,
    tenantKillSwitch,
    tenantSuspended,
    tenantStatus: tenant.status,
    alexPaused: alex?.paused ?? true,
    configurationValid,
    blocked: globalKillSwitch || tenantKillSwitch || tenantSuspended
  };
}

/** Read-only configuration snapshot, never a permit to send. */
export async function readSendState(svc: ServiceContext, opts: PolicyOptions = {}) {
  if (!svc.scopes.includes('send-state:read')) throw new AppError('FORBIDDEN');
  return withServiceTenant(
    svc,
    async (tx) => {
      await requireModule({ tenantId: svc.tenantId, role: 'system' }, 'platform', { tx });
      return sendState(tx, opts);
    },
    opts
  );
}

/** Minimal live inputs for the future n8n rule workflow; it makes no contact decision itself. */
export async function readContactPolicy(
  svc: ServiceContext,
  contactId: string,
  opts: PolicyOptions = {}
) {
  if (!svc.scopes.includes('contact-policy:read')) throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(contactId).success) throw new AppError('NOT_FOUND');
  return withServiceTenant(
    svc,
    async (tx) => {
      await requireModule({ tenantId: svc.tenantId, role: 'system' }, 'platform', { tx });
      const [contact] = await tx
        .select({
          id: contacts.id,
          timezone: contacts.timezone,
          address: contacts.address,
          dncAt: contacts.doNotCallAt,
          primaryPhone: contacts.primaryPhoneE164,
          phones: contacts.phones
        })
        .from(contacts)
        .where(
          and(eq(contacts.id, contactId), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId))
        )
        .limit(1);
      if (!contact) throw new AppError('NOT_FOUND');
      const state = await sendState(tx, opts);
      const [tenant] = await tx.select({ timezone: tenants.timezone }).from(tenants).limit(1);
      const timezone = [contact.timezone, tenant?.timezone].find(isValidTimeZone) ?? null;
      const region = contactState(contact.address);
      const numbers = [contact.primaryPhone, ...contact.phones].filter((n): n is string => !!n);
      const listed = numbers.length
        ? await tx
            .select({ id: dncEntries.id })
            .from(dncEntries)
            .where(and(inArray(dncEntries.e164, numbers), isNull(dncEntries.removedAt)))
            .limit(1)
        : [];
      const evidence = {} as Record<
        (typeof CONSENT_CHANNELS)[number],
        Array<{
          kind: string;
          source: string;
          capturedAt: string;
          revokedAt: string | null;
          evidenceRecorded: boolean;
        }>
      >;
      // Match canContact's newest-20-per-channel semantics, including ties and restrictive opt-outs.
      for (const channel of CONSENT_CHANNELS) {
        const rows = await tx
          .select({
            kind: consents.kind,
            source: consents.source,
            capturedAt: consents.capturedAt,
            revokedAt: consents.revokedAt,
            capturedText: consents.capturedText
          })
          .from(consents)
          .where(and(eq(consents.contactId, contactId), eq(consents.channel, channel)))
          .orderBy(desc(consents.capturedAt))
          .limit(20);
        evidence[channel] = rows.map(({ capturedText, ...row }) => ({
          ...row,
          evidenceRecorded: !!capturedText
        }));
      }
      const at = opts.now ?? new Date();
      const countCalls = async (hours: number, forContact: boolean) => {
        const [row] = await tx
          .select({ n: count() })
          .from(calls)
          .where(
            and(
              eq(calls.direction, 'outbound'),
              gte(calls.startedAt, new Date(at.getTime() - hours * 3_600_000).toISOString()),
              forContact ? eq(calls.contactId, contactId) : undefined
            )
          );
        return row?.n ?? 0;
      };
      const [day, week, tenantHour] = await Promise.all([
        countCalls(24, true),
        countCalls(168, true),
        countCalls(1, false)
      ]);
      const approved = await tx
        .select({ id: phoneNumbers.id })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.a2PStatus, 'approved'), isNull(phoneNumbers.releasedAt)))
        .limit(1);
      const modules = await tx
        .select({ key: tenantModules.moduleKey, enabled: tenantModules.enabled })
        .from(tenantModules);
      return {
        version: 1,
        contactId,
        ...state,
        timezone,
        state: region,
        internalDnc: !!contact.dncAt || listed.length > 0,
        consent: evidence,
        calls: { day, week, tenantHour, caps: CONTACT_CALL_CAPS, tenantHourlyCap: null },
        smsApproved: approved.length > 0,
        modules,
        rules: {
          version: STATE_RULES.version,
          reviewedByCounsel: STATE_RULES.reviewedByCounsel,
          defaultWindow: DEFAULT_WINDOW,
          stateWindow: region ? (STATE_RULES.quietWindows[region] ?? null) : null
        },
        migrationGatePassed: false
      };
    },
    opts
  );
}
