import { describe, expect, it } from 'vitest';
import { clientIp } from '@/server/terms';

describe('clientIp', () => {
  it('takes the last forwarded address, the one our proxy added', () => {
    expect(clientIp('10.0.0.1, 203.0.113.7')).toBe('203.0.113.7');
    expect(clientIp('2001:db8::1')).toBe('2001:db8::1');
  });
  it('returns null for missing or malformed input', () => {
    expect(clientIp(null)).toBeNull();
    expect(clientIp('')).toBeNull();
    expect(clientIp('not-an-ip')).toBeNull();
    expect(clientIp("1.2.3.4'; drop table users")).toBeNull();
  });
});
