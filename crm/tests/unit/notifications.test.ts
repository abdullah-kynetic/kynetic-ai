import { describe, expect, it } from 'vitest';
import { absoluteLink, renderNotificationEmail } from '@/server/notifications/email';
import { formatRelative, unreadLabel } from '@/components/notifications/use-notifications';

describe('notification email rendering', () => {
  it('links only to in-app paths', () => {
    const base = 'https://portal.example.test';
    expect(absoluteLink('/leads/1', base)).toBe('https://portal.example.test/leads/1');
    expect(absoluteLink('//evil.test/x', base)).toBeNull();
    expect(absoluteLink('https://evil.test', base)).toBeNull();
    expect(absoluteLink(null, base)).toBeNull();
  });

  it('escapes html and falls back to the title for text', () => {
    const m = renderNotificationEmail({ title: '<i>Hi</i>', body: null }, null);
    expect(m.html).toContain('&lt;i&gt;Hi&lt;/i&gt;');
    expect(m.text).toBe('<i>Hi</i>');
  });
});

describe('bell helpers', () => {
  it('announces the unread count', () => {
    expect(unreadLabel(0)).toBe('No unread notifications');
    expect(unreadLabel(1)).toBe('1 unread notification');
    expect(unreadLabel(3)).toBe('3 unread notifications');
  });

  it('formats relative times', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    expect(formatRelative('2026-10-26T11:59:30Z', now)).toBe('Just now');
    expect(formatRelative('2026-10-26T11:30:00Z', now)).toBe('30m ago');
    expect(formatRelative('2026-10-26T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelative('2026-10-24T12:00:00Z', now)).toBe('2d ago');
  });
});
