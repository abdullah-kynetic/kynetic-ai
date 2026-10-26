import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': src } },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/server/**'] }
  }
});
