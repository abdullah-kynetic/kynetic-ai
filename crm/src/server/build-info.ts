import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEnv } from './env';

const SAFE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * The commit this image was built from. BUILD_COMMIT_SHA wins (set by CI or a build arg); the
 * Docker build also writes a `build-commit` file next to the server for builds that cannot set the
 * variable. `unknown` when neither exists, so local runs never fail on it.
 */
export function buildCommit(fromVariable: string | undefined = getEnv().BUILD_COMMIT_SHA): string {
  const fromEnv = fromVariable?.trim();
  if (fromEnv && SAFE.test(fromEnv)) return fromEnv;
  try {
    const fromFile = readFileSync(join(process.cwd(), 'build-commit'), 'utf8').trim();
    if (SAFE.test(fromFile)) return fromFile;
  } catch {
    // no file in local runs
  }
  return 'unknown';
}
