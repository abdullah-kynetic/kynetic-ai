import { describe, expect, it } from 'vitest';
import { zipStored } from '@/server/admin/csv-zip';
import {
  digestDedupeKey,
  jobFailureDedupeKey,
  renderAdminDigest,
  scrubErrorSummary,
  tenantIdFromPayload
} from '@/server/admin/alerts';
import { personaSwitchingEnabled } from '@/server/auth/open-mode';
import { componentGalleryOpen } from '@/app/dev/components/access';
import { previousWeekRange, zonedClock } from '@/server/schedules/calendar';
import { RATE_LIMIT_PURGE_CRON } from '@/server/security/rate-limit';
import { capStatus, formatCents, marginCents, usageCsv, type UsageRow } from '@/server/usage';
import { clientEmailAllowed, weeklyEmailCopy } from '@/server/reports/weekly-email';

const row = (over: Partial<UsageRow> = {}): UsageRow => ({
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantName: 'Northwind',
  callCount: 2,
  callSeconds: 120,
  callCostCents: 40,
  smsCount: 1,
  emailCount: 0,
  messageCostCents: 0,
  costUnknown: false,
  monthlyFeeCents: 100,
  capCents: 80,
  llmCostMicros: 0,
  llmCapCents: null,
  ...over
});

describe('batch 3 pure checks', () => {
  it('keeps new email paths off unless both flags are on', () => {
    expect(clientEmailAllowed(false, false)).toBe(false);
    expect(clientEmailAllowed(false, true)).toBe(false);
    expect(clientEmailAllowed(true, false)).toBe(false);
    expect(clientEmailAllowed(true, true)).toBe(true);
  });

  it('writes the weekly note from the same totals the dashboard uses', () => {
    const copy = weeklyEmailCopy({
      estimatesBooked: 4,
      leads: 6,
      calls: 9,
      contactsReached: 3,
      revenueCents: 1250,
      portalUrl: 'https://portal.example.test/dashboard'
    });
    expect(copy.subject).toBe('Alex booked 4 estimates for you last week');
    expect(copy.text).toContain('New leads: 6.');
    expect(copy.text).toContain('Calls: 9.');
    expect(copy.text).toContain('People reached: 3.');
    expect(copy.text).toContain('Won work: $12.50.');
    expect(copy.text).toContain('https://portal.example.test/dashboard');
  });

  it('labels spend caps and neutralises csv formulas', () => {
    expect(capStatus(row())).toBe('under');
    expect(capStatus(row({ callCostCents: 64 }))).toBe('watch');
    expect(capStatus(row({ callCostCents: 80 }))).toBe('reached');
    expect(capStatus(row({ capCents: null }))).toBe('no_cap');
    expect(marginCents(row({ monthlyFeeCents: null }))).toBeNull();
    expect(formatCents(-20)).toBe('-$0.20');
    const csv = usageCsv([row({ tenantName: '=HYPERLINK("http://evil")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv.startsWith('client,minutes,calls')).toBe(true);
  });

  it('scrubs personal data out of a failed-job summary and dedupes by hour', () => {
    expect(scrubErrorSummary('boom user@example.test +1 555 555 0100')).toBe(
      'boom [redacted] [redacted]'
    );
    expect(
      tenantIdFromPayload({ tenantId: '11111111-1111-4111-8111-111111111111', phone: 'no' })
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(tenantIdFromPayload({ note: 'secret' })).toBeNull();
    const now = new Date('2026-11-10T16:20:00Z');
    expect(jobFailureDedupeKey('usage.daily', now)).toBe('job-failed:usage.daily:2026-11-10T16');
    expect(digestDedupeKey(now)).toBe('admin-digest:2026-11-10');
  });

  it('renders the admin digest without payloads', () => {
    const text = renderAdminDigest({
      failedJobs: [{ name: 'usage.daily', count: 2 }],
      failedWebhooks: 1,
      leads: [{ name: 'Northwind', count: 3 }],
      flaggedCalls: [],
      openSupport: 4,
      openSystemRequests: 1,
      spendWatch: [{ name: 'Northwind', percent: 80 }]
    });
    expect(text.title).toBe('Daily admin digest');
    expect(text.body).toContain('usage.daily (2)');
    expect(text.body).toContain('Northwind 3');
    expect(text.body).toContain('Open support requests: 4.');
    expect(text.body).not.toMatch(/@/);
  });

  it('stores csv bytes inside a zip', () => {
    const zip = zipStored([{ name: 'contacts.csv', body: 'id,name\n1,Ada\n' }]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('contacts.csv');
    expect(text).toContain('id,name');
    expect(text).toContain('Ada');
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });

  it('picks last week in the tenant timezone and purges rate limits hourly', () => {
    const monday = new Date('2026-11-09T16:00:00Z');
    expect(zonedClock(monday, 'America/Los_Angeles')).toMatchObject({
      hour: 8,
      weekday: 1
    });
    expect(previousWeekRange(monday, 'America/Los_Angeles')).toEqual({
      from: '2026-11-02',
      to: '2026-11-08'
    });
    expect(zonedClock(new Date('2026-11-09T15:00:00Z'), 'America/Los_Angeles').hour).toBe(7);
    expect(RATE_LIMIT_PURGE_CRON).toBe('15 * * * *');
  });

  it('refuses the gallery and persona switching in production', () => {
    expect(componentGalleryOpen('production', undefined)).toBe(false);
    expect(componentGalleryOpen('production', '1')).toBe(true);
    expect(componentGalleryOpen('test', undefined)).toBe(false);
    expect(personaSwitchingEnabled({ NODE_ENV: 'production', DEV_PERSONA_SWITCHING: true })).toBe(
      false
    );
  });
});
