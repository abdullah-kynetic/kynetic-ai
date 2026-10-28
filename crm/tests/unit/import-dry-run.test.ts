import { describe, expect, it } from 'vitest';
import { previewContacts } from '@/server/imports/dry-run';

describe('F-91 contact import dry run', () => {
  it('normalizes phone duplicates and reports invalid rows without mutating the audience', () => {
    const existing = { phones: ['+14155550100'], emails: [] as string[] };
    const result = previewContacts(
      [
        ['phone', 'email'],
        ['(415) 555-0100', ''],
        ['bad', ''],
        ['', 'new@example.com'],
        ['', 'NEW@example.com']
      ],
      { phone: 'phone', email: 'email' },
      existing
    );
    expect(result).toMatchObject({ total: 4, ok: 1, failed: 1, duplicates: 2 });
    expect(result.issues[0]?.row).toBe(3);
    expect(existing.phones).toEqual(['+14155550100']);
  });
  it('rejects mappings that reference missing headers', () => {
    expect(() => previewContacts([['name']], { email: 'missing' })).toThrow('unknown_column');
  });
});
