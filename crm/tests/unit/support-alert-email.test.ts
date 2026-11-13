import { describe, expect, it } from 'vitest';
import { supportAlertEmailAllowed } from '@/server/notifications/email';

// P3-5: the support reply email needs the server flag and the person's own setting.
describe('supportAlertEmailAllowed', () => {
  it('is off unless both are on', () => {
    expect(supportAlertEmailAllowed(false, false)).toBe(false);
    expect(supportAlertEmailAllowed(true, false)).toBe(false);
    expect(supportAlertEmailAllowed(false, true)).toBe(false);
    expect(supportAlertEmailAllowed(true, true)).toBe(true);
  });
});
