import { getEnv } from './env';

// Worker entry. pg-boss workers are registered here from M0-15 onward.
// For now it validates configuration (so a bad env stops it at boot) and idles.
getEnv();
console.log(JSON.stringify({ level: 'info', msg: 'worker started' }));
setInterval(() => undefined, 60_000);
