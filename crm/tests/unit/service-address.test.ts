import { describe, expect, it } from 'vitest';
import { addressAllowed, inCidr, isValidCidr } from '@/server/service-auth/address';

describe('service address list', () => {
  it('matches IPv4 CIDRs and bare addresses', () => {
    expect(inCidr('203.0.113.7', '203.0.113.0/24')).toBe(true);
    expect(inCidr('203.0.114.7', '203.0.113.0/24')).toBe(false);
    expect(inCidr('10.0.0.1', '10.0.0.1')).toBe(true);
    expect(inCidr('10.0.0.2', '10.0.0.1')).toBe(false);
    expect(inCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
    expect(inCidr('1.2.3.4', '1.2.3.0/25')).toBe(true);
    expect(inCidr('1.2.3.200', '1.2.3.0/25')).toBe(false);
  });
  it('matches IPv6 and v4-mapped addresses', () => {
    expect(inCidr('2001:db8::1', '2001:db8::/32')).toBe(true);
    expect(inCidr('2001:db9::1', '2001:db8::/32')).toBe(false);
    expect(inCidr('::ffff:203.0.113.7', '203.0.113.0/24')).toBe(true);
  });
  it('never matches malformed input', () => {
    expect(inCidr('unknown', '0.0.0.0/0')).toBe(false);
    expect(inCidr('1.2.3.4', 'nope')).toBe(false);
    expect(inCidr('1.2.3.4', '1.2.3.0/99')).toBe(false);
    expect(addressAllowed('unknown', ['0.0.0.0/0'])).toBe(false);
  });
  it('validates entries', () => {
    expect(isValidCidr('203.0.113.0/24')).toBe(true);
    expect(isValidCidr('2001:db8::/32')).toBe(true);
    expect(isValidCidr('203.0.113.0/33')).toBe(false);
    expect(isValidCidr('hello')).toBe(false);
  });
});
