// Local demo: starts the synthetic server (throwaway local database, fake data, outbound off) on
// port 3000. There is no sign-in (open mode): the portal opens as the Kynetic admin, and the account
// menu or /open/admin, /open/va, /open/owner, /open/staff switches who you are.
// Needs a local Postgres 16 (TEST_DATABASE_ADMIN_URL) and a built app (`bun run build`).
import { spawn } from 'node:child_process';

const url = process.env.TEST_DATABASE_ADMIN_URL;
if (!url) {
  process.stderr.write('Set TEST_DATABASE_ADMIN_URL to a LOCAL Postgres 16 superuser URL first.\n');
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url)) {
  process.stderr.write('Refusing to run: TEST_DATABASE_ADMIN_URL must point at this computer.\n');
  process.exit(1);
}

const port = process.env.E2E_PORT ?? '3000';
process.stdout.write(`\nOpening http://localhost:${port} once it is ready (fake data only).\n\n`);
const child = spawn('bun', ['tests/e2e/server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, E2E_PORT: port },
  stdio: 'inherit'
});
child.once('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill(signal));
