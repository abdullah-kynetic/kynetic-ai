import type postgres from 'postgres';
import { SEED_TENANT_SLUGS } from '../db/seed/demo';

type Sql = postgres.Sql;

/**
 * A preview database may hold only the seeded synthetic tenants (TESTING "Preview environment").
 * Returns the slugs that are not seed tenants; empty means the database is safe for preview.
 * Needs a role that can read every tenant row (the seed role), not the app role.
 */
export async function findNonSeedTenants(sql: Sql): Promise<string[]> {
  const rows = await sql<{ slug: string }[]>`select slug from tenants order by slug`;
  const allowed = new Set<string>(SEED_TENANT_SLUGS);
  return rows.map((r) => r.slug).filter((slug) => !allowed.has(slug));
}

/** Throws, naming the slugs, when the database holds anything other than seed tenants. */
export async function assertSyntheticOnly(sql: Sql): Promise<void> {
  const extra = await findNonSeedTenants(sql);
  if (extra.length > 0) {
    throw new Error(`Preview refused: non-seed tenants present: ${extra.join(', ')}`);
  }
}
