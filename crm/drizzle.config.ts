import { defineConfig } from 'drizzle-kit';

// Migrations are hand-reviewed SQL (RLS, grants, functions); the TS schema is added alongside
// by the tasks that create tables. `generate --custom` makes an empty SQL file with a journal entry.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle'
});
