import postgres from 'postgres';
import { emailSchema } from '../validation';

const CONFIRM = 'RESET-TOTP';

/** Parses the sole-admin CLI. Refuses unless the confirmation phrase is exact. */
export function parseEmergencyResetArgs(argv: readonly string[]): { email: string } {
  let email = '';
  let confirm = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--email') email = argv[++i] ?? '';
    else if (arg === '--confirm') confirm = argv[++i] ?? '';
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length);
    else if (arg.startsWith('--confirm=')) confirm = arg.slice('--confirm='.length);
  }
  if (confirm !== CONFIRM) throw new Error('Refused. Re-run with --confirm RESET-TOTP');
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new Error('Refused. Pass the staff email with --email');
  return { email: parsed.data };
}

/**
 * Runs the owner-only reset. The caller prints a fixed message and never the connection string.
 * `url` is the database owner URL (DATABASE_URL_MIGRATE).
 */
export async function resetStaffTotpEmergency(url: string, email: string): Promise<void> {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`select emergency_reset_staff_two_factor(${email})`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function emergencyResetFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/staff user not found/i.test(message)) return 'No staff account matches that email.';
  if (/permission denied/i.test(message))
    return 'This login cannot reset authenticators. Use the database owner URL (DATABASE_URL_MIGRATE).';
  return 'Reset failed.';
}
