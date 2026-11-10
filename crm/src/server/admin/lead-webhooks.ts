import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { listTenantSecretStatus, readTenantSecret, writeTenantSecret } from '../secrets';
import type { Keyring } from '../secrets/crypto';
import { setPlatformSetting } from './report-schedule';
import { asTenantAdmin, readPlatformConfig } from './tenant-admin';
import type { StaffCaller } from './users';

const binding = { provider: 'lead_webhook', name: 'signing_secret' } as const;
export const N8N_PUSH_SECRET = { provider: 'n8n', name: 'event_webhook' } as const;
type Options = { db?: Db; keyring?: Keyring };

const n8nUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      );
    } catch {
      return false;
    }
  }, 'https_url');

export async function getLeadWebhookSettings(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
) {
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
    const statuses = await listTenantSecretStatus(tx, tenantId);
    const secret = statuses.find((s) => s.provider === binding.provider && s.name === binding.name);
    const push = statuses.find(
      (s) => s.provider === N8N_PUSH_SECRET.provider && s.name === N8N_PUSH_SECRET.name
    );
    const config = await readPlatformConfig(tx);
    const parsed = n8nUrlSchema.safeParse(config.n8nWebhookUrl);
    return {
      tenantId,
      leadPath: `/api/hooks/leads/${tenantId}`,
      n8nUrl: parsed.success ? new URL(parsed.data).toString() : null,
      n8nSecret: push
        ? { isSet: true, rotatedAt: push.rotatedAt }
        : { isSet: false, rotatedAt: null },
      secret: secret
        ? { isSet: true, rotatedAt: secret.rotatedAt }
        : { isSet: false, rotatedAt: null }
    };
  });
}

/** Only the issuing response contains plaintext; subsequent reads expose status, never the value. */
export async function rotateLeadWebhookSecret(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
) {
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
    const secret = randomBytes(32).toString('base64url');
    await writeTenantSecret(tx, { tenantId, ...binding }, secret, { keyring: opts.keyring });
    await audit(tx, {
      action: 'lead_webhook.secret.rotate',
      entity: 'tenant',
      entityId: tenantId,
      after: { provider: binding.provider, name: binding.name }
    });
    return { secret };
  });
}

/**
 * Saves the n8n push URL and, when a secret is provided, encrypts it. The secret is never
 * returned and any plaintext copy in module config is removed by admin_set_platform_setting.
 */
export async function setN8nPushConfig(
  caller: StaffCaller,
  tenantId: string,
  input: { url: string; secret?: string },
  opts: Options = {}
) {
  const url = n8nUrlSchema.safeParse(input.url);
  if (!url.success)
    throw new AppError('VALIDATION_FAILED', {
      message: 'Enter an https URL with no user, password, query, or fragment.'
    });
  const secret = input.secret?.trim() ?? '';
  if (secret && (secret.length < 8 || secret.length > 200))
    throw new AppError('VALIDATION_FAILED', {
      message: 'The n8n secret must be 8 to 200 characters.'
    });
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
    await setPlatformSetting(tx, tenantId, 'n8nWebhookUrl', url.data);
    if (secret) {
      await writeTenantSecret(tx, { tenantId, ...N8N_PUSH_SECRET }, secret, {
        keyring: opts.keyring
      });
      await audit(tx, {
        action: 'n8n.push.secret',
        entity: 'tenant',
        entityId: tenantId,
        after: { provider: N8N_PUSH_SECRET.provider, name: N8N_PUSH_SECRET.name }
      });
    }
    return { url: new URL(url.data).toString(), secretWritten: Boolean(secret) };
  });
}

/** Worker delivery reads the encrypted secret. Plaintext module config is not a credential. */
export async function readN8nPushSecret(
  tx: Parameters<typeof readTenantSecret>[0],
  tenantId: string,
  opts: { keyring?: Keyring } = {}
) {
  return readTenantSecret(tx, { tenantId, ...N8N_PUSH_SECRET }, opts);
}
