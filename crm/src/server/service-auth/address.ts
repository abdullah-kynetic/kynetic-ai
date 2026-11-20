import { isIP } from 'node:net';

function toBytes(ip: string): number[] | null {
  const v = isIP(ip);
  if (v === 4) return ip.split('.').map(Number);
  if (v === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return mapped[1].split('.').map(Number);
    let head = ip;
    let tail = '';
    if (ip.includes('::')) [head, tail] = ip.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const groups = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
    if (groups.length !== 8) return null;
    return groups.flatMap((g) => {
      const n = parseInt(g, 16);
      return [n >> 8, n & 255];
    });
  }
  return null;
}

/** True when ip is inside the CIDR (or equals a bare address). Malformed input never matches. */
export function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const a = toBytes(ip);
  const b = toBytes(base ?? '');
  if (!a || !b || a.length !== b.length) return false;
  const bits = bitsRaw === undefined ? a.length * 8 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > a.length * 8) return false;
  for (let i = 0; i < a.length && bits > i * 8; i++) {
    const rem = Math.min(8, bits - i * 8);
    const mask = (0xff << (8 - rem)) & 0xff;
    if ((a[i] & mask) !== (b[i] & mask)) return false;
  }
  return true;
}

export function addressAllowed(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => inCidr(ip, c));
}

/** A valid CIDR or bare address, for the owner's key form. */
export function isValidCidr(value: string): boolean {
  const [base, bits] = value.split('/');
  const bytes = toBytes(base ?? '');
  if (!bytes) return false;
  if (bits === undefined) return true;
  return /^\d{1,3}$/.test(bits) && Number(bits) <= bytes.length * 8;
}
