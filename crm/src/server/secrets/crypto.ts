import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { getEnv } from '../env';

// AES-256-GCM with a random 96-bit nonce per value and the key version stored beside the
// ciphertext so keys can rotate (SECURITY 4.2, F-87). The raw env string is run through HKDF so
// any value of 32+ characters yields a uniform 256-bit key, and each version gets its own key.
const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_INFO = 'kynetic-tenant-secrets-v1';

export type Keyring = {
  currentVersion: number;
  /** Raw key material by version. Includes the current version. */
  keys: ReadonlyMap<number, string>;
};

export type Sealed = { ciphertext: Buffer; nonce: Buffer; keyVersion: number };

/** Names the row a ciphertext belongs to, so a value copied to another row fails to decrypt. */
export type SecretBinding = { tenantId: string; provider: string; name: string };

export class SecretDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretDecryptionError';
  }
}

function deriveKey(raw: string, version: number): Buffer {
  return Buffer.from(
    hkdfSync('sha256', raw, Buffer.alloc(0), `${HKDF_INFO}:${version}`, KEY_BYTES)
  );
}

function aad(binding: SecretBinding): Buffer {
  return Buffer.from(JSON.stringify([binding.tenantId, binding.provider, binding.name]), 'utf8');
}

/**
 * Retired keys are only needed to read rows not yet re-encrypted. Format: `2:key,3:key`.
 * Errors name the problem, never the value.
 */
export function parseRetiredKeys(raw: string | undefined): Map<number, string> {
  const out = new Map<number, string>();
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const i = part.indexOf(':');
    const version = Number(part.slice(0, i));
    const key = part.slice(i + 1);
    if (i < 1 || !Number.isInteger(version) || version < 1 || key.length < 32) {
      throw new Error('APP_ENCRYPTION_KEYS_RETIRED: expected "<version>:<key of 32+ chars>" pairs');
    }
    out.set(version, key);
  }
  return out;
}

export function buildKeyring(source: {
  APP_ENCRYPTION_KEY: string;
  APP_ENCRYPTION_KEY_VERSION: number;
  APP_ENCRYPTION_KEYS_RETIRED?: string | undefined;
}): Keyring {
  const keys = parseRetiredKeys(source.APP_ENCRYPTION_KEYS_RETIRED);
  if (keys.has(source.APP_ENCRYPTION_KEY_VERSION)) {
    throw new Error('APP_ENCRYPTION_KEYS_RETIRED: contains the current key version');
  }
  keys.set(source.APP_ENCRYPTION_KEY_VERSION, source.APP_ENCRYPTION_KEY);
  return { currentVersion: source.APP_ENCRYPTION_KEY_VERSION, keys };
}

export function getKeyring(): Keyring {
  return buildKeyring(getEnv());
}

export function seal(plaintext: string, binding: SecretBinding, keyring: Keyring): Sealed {
  const raw = keyring.keys.get(keyring.currentVersion);
  if (!raw) throw new Error('Current encryption key is missing from the keyring');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(raw, keyring.currentVersion), nonce);
  cipher.setAAD(aad(binding));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // The GCM tag rides at the end of the stored ciphertext; the table has no column for it.
  return {
    ciphertext: Buffer.concat([body, cipher.getAuthTag()]),
    nonce,
    keyVersion: keyring.currentVersion
  };
}

export function open(sealed: Sealed, binding: SecretBinding, keyring: Keyring): string {
  const raw = keyring.keys.get(sealed.keyVersion);
  if (!raw) throw new SecretDecryptionError(`No key configured for version ${sealed.keyVersion}`);
  if (sealed.ciphertext.length < TAG_BYTES || sealed.nonce.length !== NONCE_BYTES) {
    throw new SecretDecryptionError('Stored secret is malformed');
  }
  const body = sealed.ciphertext.subarray(0, sealed.ciphertext.length - TAG_BYTES);
  const tag = sealed.ciphertext.subarray(sealed.ciphertext.length - TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, deriveKey(raw, sealed.keyVersion), sealed.nonce);
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key, tampered bytes or a row mismatch all look the same, on purpose.
    throw new SecretDecryptionError('Stored secret could not be decrypted');
  }
}
