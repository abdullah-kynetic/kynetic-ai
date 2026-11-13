import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit';
import type { Db } from '../db/client';
import {
  automations,
  automationSteps,
  automationTemplates,
  automationVersions,
  serviceTokens,
  tenantModules
} from '../db/schema';
import { getEnv } from '../env';
import { checkSequence, type AutomationStepInput } from '../automations/editing';
import { listTenantSecretStatus, writeTenantSecret } from '../secrets';
import { generateServiceToken } from '../service-auth/token';
import { asTenantAdmin } from './tenant-admin';
import type { StaffCaller } from './users';

// P6-S7. After the onboarding form, one admin action sets up what a new client needs to run the Alex
// chain: reviewed default follow-up copy for the modules it has, the lead-hook signing secret, a
// booking service token for the n8n workflow, and the sheet the person building that workflow
// pastes from. It sends nothing, calls no provider and activates nothing. Running it again changes
// nothing and returns no secrets: a secret is shown once, when it is created.

export const BOOKING_TOKEN_LABEL = 'n8n booking workflow';
export const BOOKING_TOKEN_SCOPES = ['appointments:write', 'calls:write'];

/** Kynetic-written starting copy. Each passes the same compliance gate as a client edit. */
export const DEFAULT_SEQUENCES: Record<string, AutomationStepInput[]> = {
  quote_followup: [
    {
      channel: 'sms',
      delayMinutes: 1440,
      body: 'Hi, this is a follow-up on the quote we sent. Happy to answer any questions. Reply STOP to opt out.'
    },
    {
      channel: 'sms',
      delayMinutes: 4320,
      body: 'Just checking in on your quote. Want to set up a time to go over it?'
    }
  ],
  reactivation: [
    {
      channel: 'sms',
      delayMinutes: 0,
      body: 'Hi, you asked us about a project a while back. Is it still on your list? Reply STOP to opt out.'
    }
  ]
};
const TEMPLATE_FOR_MODULE: Record<string, string> = {
  quote_followup: 'quote_followup',
  reactivation: 'reactivation'
};

export type OnboardingAutomationResult = {
  tenantId: string;
  sequencesInstalled: string[];
  leadSecret: string | null;
  bookingToken: string | null;
  /** What the n8n builder needs. Contains no secret; the secrets above are returned once. */
  n8nSheet: {
    tenantId: string;
    leadHookUrl: string;
    bookingUrl: string;
    callResultUrl: string;
    tokenScopes: string[];
    externalEventIdFormat: string;
    note: string;
  };
};

export async function provisionClientAutomations(
  caller: StaffCaller,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<OnboardingAutomationResult> {
  const base = getEnv().APP_BASE_URL.replace(/\/+$/, '');
  const out = await asTenantAdmin(caller, tenantId, opts, async (tx) => {
    const modules = await tx
      .select({ key: tenantModules.moduleKey })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.enabled, true)));
    const installed: string[] = [];
    for (const { key } of modules) {
      const templateKey = TEMPLATE_FOR_MODULE[key];
      const steps = templateKey ? DEFAULT_SEQUENCES[templateKey] : undefined;
      if (!templateKey || !steps) continue;
      if (Object.keys(checkSequence(steps)).length)
        throw new Error(`Default copy for ${templateKey} fails the gate`);
      const [template] = await tx
        .select()
        .from(automationTemplates)
        .where(eq(automationTemplates.key, templateKey))
        .limit(1);
      if (!template) continue;
      await tx
        .insert(automations)
        .values({
          tenantId: sql`app_tenant_id()`,
          kind: 'template',
          templateKey,
          name: template.label,
          enabled: false,
          config: {}
        })
        .onConflictDoNothing();
      const [automation] = await tx
        .select({ id: automations.id })
        .from(automations)
        .where(and(eq(automations.templateKey, templateKey), eq(automations.kind, 'template')))
        .limit(1);
      const [has] = await tx
        .select({ id: automationVersions.id })
        .from(automationVersions)
        .where(eq(automationVersions.automationId, automation!.id))
        .limit(1);
      const [hasSteps] = await tx
        .select({ id: automationSteps.id })
        .from(automationSteps)
        .where(eq(automationSteps.automationId, automation!.id))
        .limit(1);
      if (has || hasSteps) continue; // already set up, possibly edited: leave it
      await tx.insert(automationSteps).values(
        steps.map((s, i) => ({
          tenantId,
          automationId: automation!.id,
          position: i + 1,
          channel: s.channel,
          delayMinutes: s.delayMinutes,
          body: s.body
        }))
      );
      await tx.insert(automationVersions).values({
        tenantId,
        automationId: automation!.id,
        version: 1,
        steps,
        status: 'approved',
        proposedBy: caller.id,
        decidedBy: caller.id,
        decidedAt: sql`now()`,
        decisionNote: 'Kynetic default copy at onboarding'
      });
      installed.push(templateKey);
    }

    let leadSecret: string | null = null;
    const secrets = await listTenantSecretStatus(tx, tenantId);
    if (!secrets.some((s) => s.provider === 'lead_webhook' && s.name === 'signing_secret')) {
      leadSecret = randomBytes(32).toString('base64url');
      await writeTenantSecret(
        tx,
        { tenantId, provider: 'lead_webhook', name: 'signing_secret' },
        leadSecret
      );
    }

    let bookingToken: string | null = null;
    const [token] = await tx
      .select({ id: serviceTokens.id })
      .from(serviceTokens)
      .where(
        and(
          eq(serviceTokens.tenantId, tenantId),
          eq(serviceTokens.label, BOOKING_TOKEN_LABEL),
          isNull(serviceTokens.revokedAt)
        )
      )
      .limit(1);
    if (!token) {
      const minted = generateServiceToken();
      await tx.insert(serviceTokens).values({
        tenantId,
        prefix: minted.prefix,
        keyHash: minted.keyHash,
        label: BOOKING_TOKEN_LABEL,
        scopes: BOOKING_TOKEN_SCOPES
      });
      bookingToken = minted.token;
    }

    await audit(tx, {
      action: 'tenant.provision_automation',
      entity: 'tenant',
      entityId: tenantId,
      after: {
        sequencesInstalled: installed,
        leadSecretCreated: leadSecret !== null,
        bookingTokenCreated: bookingToken !== null
      }
    });
    return { installed, leadSecret, bookingToken };
  });
  return {
    tenantId,
    sequencesInstalled: out.installed,
    leadSecret: out.leadSecret,
    bookingToken: out.bookingToken,
    n8nSheet: {
      tenantId,
      leadHookUrl: `${base}/api/hooks/leads/${tenantId}`,
      bookingUrl: `${base}/api/appointments/book`,
      callResultUrl: `${base}/api/service/call-results`,
      tokenScopes: BOOKING_TOKEN_SCOPES,
      externalEventIdFormat: 'calcom:<Cal.com booking uid>',
      note: 'Build the workflow inactive. Activation needs Abdullah’s yes. Secrets are not in this sheet.'
    }
  };
}
