import { and, eq } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { tenantSecrets } from '../db/schema';
import { getKeyring, open, seal, type Keyring, type SecretBinding } from './crypto';

// `tenant_secrets` grants nothing to kynetic_app (DATABASE 1028), so every function here needs a
// worker-role connection (`getWorkerDb()`). The web app never reads ciphertext, and no function
// below returns a decrypted value except `readTenantSecret`, which is for server code that must
// call the provider. Nothing here is exposed through a route or server action (SEC-T-34).
type Executor = Db | Tx;

export type SecretStatus = {
  provider: string;
  name: string;
  isSet: true;
  rotatedAt: string | null;
  keyVersion: number;
};

type Options = { keyring?: Keyring };

export async function writeTenantSecret(
  db: Executor,
  binding: SecretBinding,
  plaintext: string,
  opts: Options = {}
): Promise<void> {
  if (plaintext.length === 0) throw new Error('Secret value must not be empty');
  const sealed = seal(plaintext, binding, opts.keyring ?? getKeyring());
  const now = new Date().toISOString();
  await db
    .insert(tenantSecrets)
    .values({ ...binding, ...sealed })
    .onConflictDoUpdate({
      target: [tenantSecrets.tenantId, tenantSecrets.provider, tenantSecrets.name],
      set: { ...sealed, rotatedAt: now }
    });
}

export async function readTenantSecret(
  db: Executor,
  binding: SecretBinding,
  opts: Options = {}
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(tenantSecrets)
    .where(
      and(
        eq(tenantSecrets.tenantId, binding.tenantId),
        eq(tenantSecrets.provider, binding.provider),
        eq(tenantSecrets.name, binding.name)
      )
    );
  if (!row) return null;
  return open(row, binding, opts.keyring ?? getKeyring());
}

/** What an admin screen may show: that a secret is set and when it last changed. Never the value. */
export async function listTenantSecretStatus(
  db: Executor,
  tenantId: string
): Promise<SecretStatus[]> {
  const rows = await db
    .select({
      provider: tenantSecrets.provider,
      name: tenantSecrets.name,
      rotatedAt: tenantSecrets.rotatedAt,
      keyVersion: tenantSecrets.keyVersion
    })
    .from(tenantSecrets)
    .where(eq(tenantSecrets.tenantId, tenantId));
  return rows.map((r) => ({ ...r, isSet: true as const }));
}

/** Re-encrypts every row not on the current key version. Returns how many rows moved. */
export async function reencryptTenantSecrets(db: Db, opts: Options = {}): Promise<number> {
  const keyring = opts.keyring ?? getKeyring();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tenantSecrets);
    let moved = 0;
    for (const row of rows) {
      if (row.keyVersion === keyring.currentVersion) continue;
      const binding = { tenantId: row.tenantId, provider: row.provider, name: row.name };
      const sealed = seal(open(row, binding, keyring), binding, keyring);
      await tx
        .update(tenantSecrets)
        .set({ ...sealed, rotatedAt: new Date().toISOString() })
        .where(eq(tenantSecrets.id, row.id));
      moved += 1;
    }
    return moved;
  });
}
