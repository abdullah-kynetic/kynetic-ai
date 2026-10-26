import { describe, expect, it } from 'vitest';
import {
  buildKeyring,
  open,
  parseRetiredKeys,
  seal,
  SecretDecryptionError
} from '@/server/secrets/crypto';

const K1 = 'a'.repeat(40);
const K2 = 'b'.repeat(40);
const binding = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  provider: 'twilio',
  name: 'token'
};
const v1 = buildKeyring({ APP_ENCRYPTION_KEY: K1, APP_ENCRYPTION_KEY_VERSION: 1 });
const v2 = buildKeyring({
  APP_ENCRYPTION_KEY: K2,
  APP_ENCRYPTION_KEY_VERSION: 2,
  APP_ENCRYPTION_KEYS_RETIRED: `1:${K1}`
});

describe('F-87 secret encryption', () => {
  it('round-trips and never stores the plaintext', () => {
    const sealed = seal('sk_live_example_value', binding, v1);
    expect(sealed.ciphertext.toString('utf8')).not.toContain('sk_live');
    expect(sealed.nonce).toHaveLength(12);
    expect(open(sealed, binding, v1)).toBe('sk_live_example_value');
  });

  it('uses a fresh nonce each time', () => {
    const a = seal('same', binding, v1);
    const b = seal('same', binding, v1);
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('refuses tampered ciphertext', () => {
    const sealed = seal('value', binding, v1);
    sealed.ciphertext[0] ^= 1;
    expect(() => open(sealed, binding, v1)).toThrow(SecretDecryptionError);
  });

  it('refuses a ciphertext moved to another tenant, provider or name', () => {
    const sealed = seal('value', binding, v1);
    for (const other of [
      { ...binding, tenantId: '22222222-2222-2222-2222-222222222222' },
      { ...binding, provider: 'resend' },
      { ...binding, name: 'sid' }
    ]) {
      expect(() => open(sealed, other, v1)).toThrow(SecretDecryptionError);
    }
  });

  it('seals under the current version and still opens old versions after rotation', () => {
    const old = seal('value', binding, v1);
    expect(seal('value', binding, v2).keyVersion).toBe(2);
    expect(open(old, binding, v2)).toBe('value');
  });

  it('fails without echoing key material when the version has no key', () => {
    const sealed = seal('value', binding, v2);
    try {
      open(sealed, binding, v1);
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/version 2/);
      expect(String(e)).not.toContain(K1);
    }
  });

  it('rejects malformed retired-key config without echoing it', () => {
    expect(() => parseRetiredKeys('1:short')).toThrow(/APP_ENCRYPTION_KEYS_RETIRED/);
    try {
      parseRetiredKeys('1:short-secret');
    } catch (e) {
      expect(String(e)).not.toContain('short-secret');
    }
    expect(() =>
      buildKeyring({
        APP_ENCRYPTION_KEY: K2,
        APP_ENCRYPTION_KEY_VERSION: 1,
        APP_ENCRYPTION_KEYS_RETIRED: `1:${K1}`
      })
    ).toThrow(/current key version/);
  });
});
