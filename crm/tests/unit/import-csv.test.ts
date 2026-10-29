import { describe, expect, it } from 'vitest';
import { parseImportCsv } from '@/server/imports/csv';

const bytes = (text: string) => new TextEncoder().encode(text);
describe('F-90 CSV intake', () => {
  it('parses quoted commas, escaped quotes and line breaks', () => {
    expect(parseImportCsv(bytes('name,note\r\n"A, B","say ""hi""\nnext"\r\n'))).toEqual([
      ['name', 'note'],
      ['A, B', 'say "hi"\nnext']
    ]);
  });
  it('rejects malformed quotes and more than 50,000 data rows', () => {
    expect(() => parseImportCsv(bytes('a\n"unfinished'))).toThrow();
    expect(() => parseImportCsv(bytes(`a\n${'x\n'.repeat(50_001)}`))).toThrow('too_many_rows');
  });
});
