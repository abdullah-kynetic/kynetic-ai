import { and, eq, sql } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { canContact, recordConsent } from '../consent';
import { createDb } from '../db/client';
import { contacts, tenantModules } from '../db/schema';
import type { Env } from '../env';
import { checkOutbound } from '../outbound/gate';
import { assertSyntheticOnly } from '../preview/guard';
import { withTenant } from '../tenancy';
import { assertDevPortal } from './dev-policy';

function requireCheck(value: boolean, name: string): asserts value {
  if (!value) throw new Error(`DEV gate verification failed: ${name}`);
}

/** Gate decisions only: no provider adapters, addresses, queue dispatch or external writes. */
export async function verifyDevGates(
  admin: Sql,
  env: Pick<
    Env,
    | 'APP_BASE_URL'
    | 'PROVIDER_MODE'
    | 'OUTBOUND_ENABLED'
    | 'ELEVENLABS_LIVE_ENABLED'
    | 'DEV_PERSONA_SWITCHING'
  >
) {
  assertDevPortal(env.APP_BASE_URL);
  requireCheck(
    env.PROVIDER_MODE === 'stub' &&
      !env.OUTBOUND_ENABLED &&
      !env.ELEVENLABS_LIVE_ENABLED &&
      !env.DEV_PERSONA_SWITCHING,
    'runtime isolation'
  );
  await assertSyntheticOnly(admin);
  const [tenant] = await admin<{ id: string }[]>`select id from tenants where slug = 'demo-a'`;
  requireCheck(!!tenant, 'synthetic demo-a tenant');
  const ctx = { tenantId: tenant.id, role: 'system' as const };
  const db = createDb(admin);
  const midday = new Date('2026-11-05T18:00:00Z'); // 10:00 PST
  const quiet = new Date('2026-11-06T06:00:00Z'); // 22:00 PST
  const checked: string[] = [];

  for (const tenantKill of [false, true]) {
    const rollback = new Error('DEV verification rollback');
    let contactId: string | undefined;
    try {
      await withTenant(
        ctx,
        async (tx) => {
          // All fixture writes are in this transaction, which must never commit.
          const [contact] = await tx
            .insert(contacts)
            .values({
              tenantId: tenant.id,
              firstName: 'DEV Step3 Rollback Verification',
              primaryEmail: 'dev-step3-verification@example.test',
              source: 'dev_codex_verification',
              timezone: 'America/Los_Angeles',
              address: { state: 'CA' }
            })
            .returning({ id: contacts.id });
          contactId = contact.id;
          if (tenantKill) {
            const updated = await tx
              .update(tenantModules)
              .set({
                config: sql`coalesce(${tenantModules.config}, '{}'::jsonb) || '{"outbound_kill_switch":true}'::jsonb`
              })
              .where(
                and(eq(tenantModules.tenantId, tenant.id), eq(tenantModules.moduleKey, 'platform'))
              )
              .returning({ id: tenantModules.tenantId });
            requireCheck(updated.length === 1, 'platform fixture');
          }
          // Execute actual gate queries under the runtime worker role/RLS, not superuser visibility.
          await tx.execute(sql`set local role kynetic_worker`);
          const [identity] = await tx.execute(sql`select current_user as role`);
          requireCheck(identity.role === 'kynetic_worker', 'worker role');
          const request = {
            contactId: contact.id,
            channel: 'phone_call' as const,
            module: 'alex_core' as const,
            purpose: 'dev_step3_rollback_verification'
          };
          if (tenantKill) {
            // Test seam reaches the tenant switch without enabling runtime outbound or a sender.
            const decision = await checkOutbound(ctx, request, midday, {
              tx,
              outboundEnabled: true
            });
            requireCheck(
              !decision.allowed && decision.reason === 'outbound_disabled',
              'tenant kill switch'
            );
            checked.push('tenant_kill');
          } else {
            const global = await checkOutbound(ctx, request, midday, {
              tx,
              outboundEnabled: env.OUTBOUND_ENABLED
            });
            requireCheck(
              !global.allowed && global.reason === 'outbound_disabled',
              'global kill switch'
            );
            checked.push('global_kill');
            const absent = await canContact(ctx, contact.id, 'phone_call', midday, { tx });
            requireCheck(!absent.allowed && absent.reason === 'no_consent', 'missing consent');
            checked.push('consent');
            await recordConsent(
              ctx,
              {
                contactId: contact.id,
                channel: 'phone_call',
                source: 'form',
                capturedText: 'DEV rollback-only synthetic verification. No contact requested.',
                capturedAt: new Date('2026-11-05T17:00:00Z')
              },
              { tx }
            );
            const allowed = await canContact(ctx, contact.id, 'phone_call', midday, { tx });
            requireCheck(allowed.allowed, 'consent/daytime control');
            const late = await canContact(ctx, contact.id, 'phone_call', quiet, { tx });
            requireCheck(
              !late.allowed &&
                late.reason === 'quiet_hours' &&
                !!late.retryAt &&
                late.retryAt > quiet,
              'quiet-hours deferral'
            );
            checked.push('quiet_hours');
          }
          throw rollback;
        },
        { db }
      );
      throw new Error('DEV gate fixture unexpectedly committed');
    } catch (error) {
      if (error !== rollback) throw error;
    }
    requireCheck(!!contactId, 'fixture created');
    const [remaining] = await admin<
      { n: number }[]
    >`select count(*)::int as n from contacts where id = ${contactId}`;
    requireCheck(remaining.n === 0, 'fixture rollback');
  }
  requireCheck(checked.length === 4, 'all four gate cases');
  return {
    consent: 'blocked',
    quiet_hours: 'deferred',
    global_kill: 'blocked',
    tenant_kill: 'blocked',
    fixtures: 'rolled_back',
    provider_requests: 0
  } as const;
}
