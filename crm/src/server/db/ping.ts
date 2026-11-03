import postgres from 'postgres';

/** Returns true when a trivial query succeeds. Opens a short-lived connection. */
export async function pingDatabase(url: string, timeoutMs = 2000): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: Math.ceil(timeoutMs / 1000) });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
