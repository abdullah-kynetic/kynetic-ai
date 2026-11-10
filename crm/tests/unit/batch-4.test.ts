import { describe, expect, it } from 'vitest';
import { buildFinanceMonths, financeSummaryForMonth } from '@/server/agency/finance-math';
import { pacificDateTimeToUtc, pacificMonth } from '@/server/agency/pacific-time';
import { productionSimulationRefused } from '@/server/agency/production-guard';
import { agencyFinanceCsv } from '@/server/agency/finance';
import { PRICING_PLACEHOLDER, renderProposalPdf } from '@/server/proposals/pdf';
import {
  inspectXlsxZip,
  parseImportXlsx,
  uncachedFormulaCells,
  XlsxRejectedError
} from '@/server/imports/xlsx';
import { buildXlsx, buildZip, sheetWithRows } from '../helpers/xlsx-fixture';

describe('Pacific callback time', () => {
  it('converts standard and daylight Pacific times to UTC', () => {
    expect(pacificDateTimeToUtc('2026-01-15', '09:30')).toBe('2026-01-15T17:30:00.000Z');
    expect(pacificDateTimeToUtc('2026-07-15', '09:30')).toBe('2026-07-15T16:30:00.000Z');
    expect(pacificMonth('2026-11-01')).toBe('2026-11');
    expect(pacificMonth('2026-11-01T06:30:00.000Z')).toBe('2026-10');
  });
  it('rejects a date that does not exist', () => {
    expect(() => pacificDateTimeToUtc('2026-02-31', '09:30')).toThrow('invalid_pacific_datetime');
  });
});

describe('finance month math', () => {
  it('adds won deals and manual revenue and subtracts live expenses', () => {
    const months = buildFinanceMonths(
      [{ cents: 10_000, wonAt: '2026-11-02T20:00:00.000Z', title: 'Won' }],
      [
        { cents: 500, on: '2026-11-03', label: 'Manual' },
        { cents: 900, on: '2026-11-03', label: 'Removed', deleted: true }
      ],
      [{ cents: 2_000, on: '2026-11-04', label: 'Ads' }]
    );
    expect(financeSummaryForMonth(months, '2026-11')).toEqual({
      month: '2026-11',
      revenueCents: 10_500,
      expenseCents: 2_000,
      netCents: 8_500
    });
  });
  it('neutralizes formula text in a finance CSV', () => {
    const csv = agencyFinanceCsv('expenses', {
      months: [],
      summary: { month: '2026-11', revenueCents: 0, expenseCents: 0, netCents: 0 },
      won: [],
      manual: [],
      expenses: [
        {
          id: 'x',
          tenantId: 'x',
          spentOn: '2026-11-01',
          vendor: '=cmd()',
          category: 'ads',
          amountCents: 100,
          note: '',
          createdBy: 'x',
          updatedBy: 'x',
          createdAt: '',
          updatedAt: '',
          deletedAt: null
        }
      ],
      referrals: [],
      studies: []
    });
    expect(csv).toContain(`"'=cmd()"`);
    expect(csv.startsWith('"date","vendor"')).toBe(true);
  });
});

describe('production simulation gate', () => {
  it('refuses only when NODE_ENV is production', () => {
    expect(productionSimulationRefused('production')).toBe(true);
    expect(productionSimulationRefused('test')).toBe(false);
    expect(productionSimulationRefused('development')).toBe(false);
  });
});

describe('xlsx safety', () => {
  it('reads stored values and flags a formula with no cached value', async () => {
    const sheet = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>score</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>Ada</t></is></c><c r="B2"><f>1+1</f><v>2</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>Bea</t></is></c><c r="C3" t="str"><f>1+1</f></c></row>
</sheetData></worksheet>`;
    const parsed = await parseImportXlsx(buildXlsx(sheet));
    expect(parsed.rows[1]).toEqual(['Ada', '2']);
    expect(JSON.stringify(parsed.rows)).not.toContain('1+1');
    expect(parsed.blocked.get(3)).toMatch(/formula_not_cached: C3/);
    expect(uncachedFormulaCells(sheet).map((cell) => cell.cell)).toEqual(['C3']);
  });
  it('rejects a declared zip bomb, too many entries, and a macro renamed as xlsx', () => {
    expect(() =>
      inspectXlsxZip(
        buildZip([
          { name: 'xl/workbook.xml', data: Buffer.from('x'), uncompressedSize: 2_000_000_000 }
        ])
      )
    ).toThrow(XlsxRejectedError);
    const many = Array.from({ length: 80 }, (_, index) => ({
      name: `file-${index}.xml`,
      data: Buffer.from('<a/>')
    }));
    expect(() => inspectXlsxZip(buildZip(many))).toThrow(/too_many_entries/);
    expect(() =>
      inspectXlsxZip(
        buildXlsx(sheetWithRows([['a']]), [
          { name: 'xl/vbaProject.bin', data: Buffer.from('macro') }
        ])
      )
    ).toThrow(/macros/);
  });
  it('reads a 1,000-row sheet', async () => {
    const rows = [['first', 'phone']];
    for (let i = 0; i < 1000; i++)
      rows.push([`Synthetic ${i}`, `415555${String(1000 + i).slice(-4)}`]);
    const parsed = await parseImportXlsx(buildXlsx(sheetWithRows(rows)));
    expect(parsed.rows).toHaveLength(1001);
    expect(parsed.rows[1000]?.[0]).toBe('Synthetic 999');
    expect(parsed.blocked.size).toBe(0);
  });
});

describe('proposal pdf', () => {
  it('includes the typed sections, branding, and the pricing placeholder', async () => {
    const bytes = await renderProposalPdf({
      title: 'Growth plan',
      dealTitle: 'Ada remodeling',
      problem: 'Leads wait overnight.',
      solution: 'Alex calls new leads.',
      roadmap: 'Week 1 setup.',
      roi: 'More booked estimates.'
    });
    const raw = Buffer.from(bytes).toString('latin1');
    const text = [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((match) => Buffer.from(match[1]!, 'hex').toString('latin1'))
      .join('');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('Kynetic AI');
    expect(text).toContain('AI growth partner');
    expect(text).toContain('Leads wait overnight.');
    expect(text).toContain('Alex calls new leads.');
    expect(text).toContain('Week 1 setup.');
    expect(text).toContain('More booked estimates.');
    expect(text).toContain(PRICING_PLACEHOLDER);
  });
});
