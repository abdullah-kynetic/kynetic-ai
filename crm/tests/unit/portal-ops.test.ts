import { describe, expect, it } from 'vitest';
import { classifyImportUpload } from '@/server/imports';
import { previousMonthStart, utcDay, zonedDate } from '@/server/schedules';
import { liveChargeBlocked } from '@/server/agency/billing';
import { retentionCutoffs } from '@/server/retention/purge';

describe('report calendar', () => {
  it('uses the tenant timezone and the previous month on the configured day', () => {
    const now = new Date('2026-11-05T07:30:00Z');
    expect(zonedDate(now, 'America/Los_Angeles')).toEqual({ year: 2026, month: 11, day: 4 });
    expect(zonedDate(now, 'America/Los_Angeles'.replace('Los_Angeles', 'New_York'))).toEqual({
      year: 2026,
      month: 11,
      day: 5
    });
    expect(zonedDate(now, 'Not/AZone')).toEqual({ year: 2026, month: 11, day: 5 });
    expect(previousMonthStart(2026, 11)).toBe('2026-10-01');
    expect(previousMonthStart(2026, 1)).toBe('2025-12-01');
    expect(utcDay(now)).toBe('2026-11-05');
  });
});

describe('import file kinds', () => {
  it('accepts csv and refuses excel extensions', () => {
    expect(classifyImportUpload('clients.csv')).toBe('csv');
    expect(classifyImportUpload('Clients.CSV')).toBe('csv');
    expect(classifyImportUpload('book.xlsx')).toBe('excel');
    expect(classifyImportUpload('macro.xlsm')).toBe('excel');
    expect(classifyImportUpload('old.xls')).toBe('excel');
    expect(classifyImportUpload('notes.txt')).toBe('unsupported');
  });
});

describe('agency billing mode', () => {
  it('describes a blocked live charge without implying a local save failed', () => {
    expect(liveChargeBlocked().message).toMatch(/nothing was sent or charged/i);
    expect(liveChargeBlocked().code).toBe('FORBIDDEN');
  });
});

describe('retention windows', () => {
  it('uses the PRD decision 9 windows', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const cutoffs = retentionCutoffs(now);
    expect(cutoffs.messagesBefore.toISOString()).toBe('2024-11-10T00:00:00.000Z');
    expect(cutoffs.consentsBefore.toISOString()).toBe('2021-11-10T00:00:00.000Z');
    expect(cutoffs.importsBefore.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(cutoffs.webhooksBefore.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });
});
