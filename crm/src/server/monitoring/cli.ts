import { wireEmail } from '../email/wire';
import { getEnv } from '../env';
import { runMonitoringCheck } from './run';

// Host-side check (docs/runbooks/monitoring.md). It runs outside the worker, so a dead worker still alerts.
// Prints one line per firing rule and exits 1 when anything fires, so cron mail or a wrapper can notice too.
wireEmail(getEnv());
try {
  const { firing, notified } = await runMonitoringCheck();
  for (const alert of firing) {
    const fresh = notified.some((n) => n.rule === alert.rule) ? 'new' : 'already sent';
    console.log(`ALERT ${alert.rule} (${fresh}): ${alert.detail}`);
  }
  if (!firing.length) console.log('monitor: all rules ok');
  process.exit(firing.length ? 1 : 0);
} catch (error) {
  console.error(
    `monitor: check could not run: ${error instanceof Error ? error.message : 'unknown'}`
  );
  process.exit(2);
}
