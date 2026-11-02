import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { getWorkerDb, type Db, type Tx } from '../db/client';
import { tenantModules, tenants, users } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { listTenantSecretStatus, writeTenantSecret } from '../secrets';
import type { Keyring } from '../secrets/crypto';
import { withTenant } from '../tenancy';
import type { StaffCaller } from './users';

const binding = { provider: 'lead_webhook', name: 'signing_secret' } as const;
type Options = { db?: Db; keyring?: Keyring };

async function asAdmin<T>(
  caller: StaffCaller,
  tenantId: string,
  opts: Options,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  if (caller.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId, userId: caller.id, role: 'admin' },
    async (tx) => {
      await requireModule({ tenantId, role: 'admin' }, 'platform', { tx });
      // Recheck database role/disabled status before the privileged secret-store operation.
      const [user] = await tx
        .select({ role: users.kyneticRole })
        .from(users)
        .where(and(eq(users.id, caller.id), isNull(users.disabledAt)))
        .limit(1);
      if (user?.role !== 'admin') throw new AppError('FORBIDDEN');
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) throw new AppError('NOT_FOUND');
      return fn(tx);
    },
    { db: opts.db ?? getWorkerDb() }
  );
}

export async function getLeadWebhookSettings(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
) {
  return asAdmin(caller, tenantId, opts, async (tx) => {
    const statuses = await listTenantSecretStatus(tx, tenantId);
    const secret = statuses.find((s) => s.provider === binding.provider && s.name === binding.name);
    const [platform] = await tx
      .select({ config: tenantModules.config })
      .from(tenantModules)
      .where(eq(tenantModules.moduleKey, 'platform'))
      .limit(1);
    const config = platform?.config as { n8nWebhookUrl?: unknown } | undefined;
    const parsed = z.url().safeParse(config?.n8nWebhookUrl);
    let n8nUrl: string | null = null;
    if (parsed.success) {
      const url = new URL(parsed.data);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash)
        n8nUrl = url.toString();
    }
    return {
      tenantId,
      leadPath: `/api/hooks/leads/${tenantId}`,
      n8nUrl,
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
  return asAdmin(caller, tenantId, opts, async (tx) => {
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
