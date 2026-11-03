import { describe, expect, it } from 'vitest';
import { neutralizeCsvCell } from '@/server/contacts';

describe('F-38 CSV formula safety', () => {
  it('quotes cells and neutralizes spreadsheet formula prefixes', () => {
    expect(neutralizeCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(neutralizeCsvCell('  @SUM(A1:A2)')).toBe('"\'  @SUM(A1:A2)"');
    expect(neutralizeCsvCell('hello "world"')).toBe('"hello ""world"""');
    expect(neutralizeCsvCell(null)).toBe('""');
  });
});
