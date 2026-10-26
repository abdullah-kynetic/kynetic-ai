import { getEnv } from './env';

/** Validates configuration; exits the process on failure so a bad env never serves traffic. */
export function validateBoot() {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid environment configuration');
    process.exit(1);
  }
}
