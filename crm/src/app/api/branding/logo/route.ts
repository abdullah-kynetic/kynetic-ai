import { getStorage } from '@/server/adapters/storage';
import { isLogoKey } from '@/server/branding';
import { loadShellContext } from '@/server/shell';
import { eq } from 'drizzle-orm';
import { withTenant } from '@/server/tenancy';
import { tenants } from '@/server/db/schema';
import { cookies, headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * The signed-in user's own tenant logo. The tenant comes from the session, never from the URL, so
 * there is no way to ask for another tenant's file. Served as stored (already re-encoded PNG).
 */
export async function GET() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) return new Response(null, { status: 404 });
  const [row] = await withTenant(
    { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role },
    (tx) =>
      tx
        .select({ logo: tenants.logoUrl })
        .from(tenants)
        .where(eq(tenants.id, shell.tenant!.id))
        .limit(1)
  );
  if (!isLogoKey(row?.logo)) return new Response(null, { status: 404 });
  const file = await getStorage().get(row.logo);
  if (!file) return new Response(null, { status: 404 });
  return new Response(Buffer.from(file.body), {
    headers: {
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable'
    }
  });
}
