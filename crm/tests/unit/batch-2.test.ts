import { describe, expect, test } from 'vitest';
import {
  hourIsOpen,
  shiftAnchor,
  visibleRange,
  zonedDateTime,
  zonedMidnight
} from '@/components/appointments/model';
import { stopBucket, stepView } from '@/server/automations/history';
import {
  bookingRatePercent,
  daysInclusive,
  medianSpeedToLeadMinutes
} from '@/server/metrics/formulas';
import { presetRange, resolveDashboardRange } from '@/server/metrics/range';
import { sanitizeSupportText } from '@/server/support';
import { safeNextPath, termsRedirectTarget } from '@/server/terms/gate';

describe('dashboard formulas', () => {
  test('median minutes rounds the middle of an even sample', () => {
    expect(medianSpeedToLeadMinutes([])).toBeNull();
    expect(medianSpeedToLeadMinutes([30])).toBe(30);
    expect(medianSpeedToLeadMinutes([90, 30])).toBe(60);
    expect(medianSpeedToLeadMinutes([10.4, 10.4])).toBe(10);
  });

  test('booking rate is a whole percent and is empty without leads', () => {
    expect(bookingRatePercent(1, 4)).toBe(25);
    expect(bookingRatePercent(0, 4)).toBe(0);
    expect(bookingRatePercent(2, 0)).toBeNull();
  });

  test('range falls back when the window is too long, backwards, or in the future', () => {
    const now = new Date('2026-11-10T20:00:00Z');
    const zone = 'America/Los_Angeles';
    expect(resolveDashboardRange({}, now, zone)).toEqual({
      ...presetRange(30, now, zone),
      notice: null
    });
    expect(
      resolveDashboardRange({ from: '2026-11-01', to: '2026-11-10' }, now, zone).notice
    ).toBeNull();
    expect(
      resolveDashboardRange({ from: '2026-11-10', to: '2026-11-01' }, now, zone).notice
    ).toBeTruthy();
    expect(
      resolveDashboardRange({ from: '2026-11-01', to: '2026-12-01' }, now, zone).notice
    ).toBeTruthy();
    expect(daysInclusive('2026-01-01', '2026-12-31')).toBe(365);
    expect(daysInclusive('2024-01-01', '2024-12-31')).toBe(366);
    expect(
      resolveDashboardRange({ from: '2024-01-01', to: '2024-12-31' }, now, zone).notice
    ).toBeNull();
    expect(
      resolveDashboardRange({ from: '2023-01-01', to: '2024-01-02' }, now, zone).notice
    ).toBeTruthy();
  });
});

describe('terms gate', () => {
  test('stays off unless the flag is on and a client still owes acceptance', () => {
    expect(
      termsRedirectTarget({ enabled: false, staff: false, pending: true, path: '/dashboard' })
    ).toBeNull();
    expect(
      termsRedirectTarget({ enabled: true, staff: true, pending: true, path: '/dashboard' })
    ).toBeNull();
    expect(
      termsRedirectTarget({ enabled: true, staff: false, pending: false, path: '/dashboard/calls' })
    ).toBeNull();
    expect(
      termsRedirectTarget({ enabled: true, staff: false, pending: true, path: '/dashboard/calls' })
    ).toBe('/terms/accept?next=%2Fdashboard%2Fcalls');
  });

  test('refuses an open redirect', () => {
    expect(safeNextPath('https://evil.example/phish')).toBe('/dashboard');
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
    expect(safeNextPath('/\\evil')).toBe('/dashboard');
    expect(safeNextPath('/%2F%2Fevil.example')).toBe('/dashboard');
    expect(safeNextPath('/dashboard/support?sent=1')).toBe('/dashboard/support?sent=1');
  });
});

describe('automation history labels', () => {
  test('groups stop reasons and step status', () => {
    expect(stopBucket('stopped_reply', null)).toBe('reply');
    expect(stopBucket('stopped_booked', null)).toBe('booking');
    expect(stopBucket('stopped_manual', 'opt_out')).toBe('opt_out');
    expect(stopBucket('completed', null)).toBeNull();
    expect(
      stepView({
        position: 2,
        channel: 'sms',
        currentStep: 2,
        runStatus: 'failed',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T01:00:00Z'
      }).status
    ).toBe('failed');
  });
});

describe('appointment calendar', () => {
  test('places a UTC instant on the tenant calendar and shades closed hours', () => {
    expect(zonedDateTime('2026-11-16T18:00:00.000Z', 'America/Los_Angeles')).toMatchObject({
      date: '2026-11-16',
      minutes: 10 * 60
    });
    const hours = { mon: [{ open: '08:00', close: '17:00' }] };
    expect(hourIsOpen(hours, '2026-11-16', 10)).toBe(true);
    expect(hourIsOpen(hours, '2026-11-16', 18)).toBe(false);
    expect(hourIsOpen({}, '2026-11-16', 10)).toBeNull();
    expect(visibleRange('week', '2026-11-16')).toEqual({
      start: '2026-11-16',
      end: '2026-11-23'
    });
    expect(shiftAnchor('day', '2026-11-16', 1)).toBe('2026-11-17');
    expect(zonedMidnight('2026-11-16', 'America/Los_Angeles').toISOString()).toBe(
      '2026-11-16T08:00:00.000Z'
    );
  });
});

describe('support text', () => {
  test('drops markup and control characters', () => {
    expect(sanitizeSupportText(' Hello <b>there</b> ')).toBe('Hello bthere/b');
  });
});
