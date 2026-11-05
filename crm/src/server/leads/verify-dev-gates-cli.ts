// One-shot DEV Compose service only. No service/provider credentials or public route are added.
import postgres from 'postgres';
import { getEnv } from '../env';
import { verifyDevGates } from './verify-dev-gates';

let admin: ReturnType<typeof postgres> | undefined;
try {
  const env = getEnv();
  const url = process.env.DATABASE_URL_SEED;
  if (!url) throw new Error('Missing dev verification database selector');
  const target = new URL(url);
  if (target.hostname !== 'postgres' || target.pathname !== '/kynetic')
    throw new Error('Dev verification database selector rejected');
  admin = postgres(url, { max: 1 });
  const result = await verifyDevGates(admin, env);
  process.stdout.write('PASS DEV_STEP3_GATES ' + JSON.stringify(result) + '\n');
} catch {
  // SQL/provider error strings can contain credentials. Never emit raw diagnostics here.
  console.error(
    'FAIL DEV_STEP3_GATES; inspect the private dev deployment log locally; do not paste secrets'
  );
  process.exitCode = 1;
} finally {
  await admin?.end();
}
