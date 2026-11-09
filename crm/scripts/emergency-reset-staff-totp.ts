import {
  emergencyResetFailureMessage,
  parseEmergencyResetArgs,
  resetStaffTotpEmergency
} from '../src/server/auth/emergency-reset';

// Sole-admin break-glass. See scripts/emergency-reset-staff-totp.md.
// Does not print the database URL, the secret, or a password.
const url = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL_MIGRATE or DATABASE_URL is required. Use the database owner login.');
  process.exit(1);
}

let email: string;
try {
  email = parseEmergencyResetArgs(process.argv.slice(2)).email;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Refused.');
  process.exit(1);
}

try {
  await resetStaffTotpEmergency(url, email);
} catch (error) {
  console.error(emergencyResetFailureMessage(error));
  process.exit(1);
}

process.stdout.write(
  `Reset authenticator for ${email}. They sign in with Google and enroll again.\n`
);
