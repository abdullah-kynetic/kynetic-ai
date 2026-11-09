import { describe, expect, it } from 'vitest';
import { totpQrSvg } from '@/components/auth/totp-qr';
import {
  emergencyResetFailureMessage,
  parseEmergencyResetArgs
} from '@/server/auth/emergency-reset';
import { withoutBackupCodes } from '@/server/auth/two-factor';

const SECRET = 'JBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/Kynetic:owner@example.test?secret=${SECRET}&issuer=Kynetic`;

describe('authenticator enrolment payload', () => {
  it('renders a QR image and does not print the secret', () => {
    const svg = totpQrSvg(URI);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain(SECRET);
    expect(svg).not.toContain('backup');
  });

  it('drops backup codes from the enrolment payload', () => {
    expect(
      withoutBackupCodes({
        method: 'totp',
        totpURI: URI,
        backupCodes: ['11111111', '22222222']
      })
    ).toEqual({ method: 'totp', totpURI: URI });
  });
});

describe('sole-admin authenticator reset arguments', () => {
  it('requires the confirmation phrase and a staff email', () => {
    expect(
      parseEmergencyResetArgs(['--email', 'Admin@Example.test', '--confirm', 'RESET-TOTP'])
    ).toEqual({
      email: 'admin@example.test'
    });
    expect(() => parseEmergencyResetArgs(['--email', 'admin@example.test'])).toThrow(/RESET-TOTP/);
    expect(() =>
      parseEmergencyResetArgs(['--email', 'not-an-email', '--confirm', 'RESET-TOTP'])
    ).toThrow(/email/);
  });

  it('maps database failures to fixed messages', () => {
    expect(emergencyResetFailureMessage(new Error('staff user not found'))).toMatch(
      /No staff account/
    );
    expect(emergencyResetFailureMessage(new Error('permission denied for function'))).toMatch(
      /database owner/
    );
    expect(emergencyResetFailureMessage(new Error('password=secret'))).toBe('Reset failed.');
  });
});
