import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

// Integration tests run against a real Postgres (DATABASE_URL_TEST).
// Added in M0-04 onward; the suite is empty until then.
export default defineConfig({
  resolve: { alias: { '@': src } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    passWithNoTests: true,
    fileParallelism: false
  }
});
