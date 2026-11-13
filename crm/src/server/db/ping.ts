import postgres from 'postgres';

/** Returns true when a trivial query succeeds. Opens a short-lived connection. */
export async function pingDatabase(url: string, timeoutMs = 2000): Promise<boolean> {
  return (await readHealth(url, timeoutMs)).database;
}

export type HealthRead = {
  database: boolean;
  /** Seconds since the worker's last heartbeat, by the database clock. Null when none can be read. */
  workerAgeSeconds: number | null;
};

/** One short-lived connection: is the database up, and how old is the worker heartbeat. */
export async function readHealth(url: string, timeoutMs = 2000): Promise<HealthRead> {
  const sql = postgres(url, { max: 1, connect_timeout: Math.ceil(timeoutMs / 1000) });
  try {
    await sql`select 1`;
  } catch {
    await sql.end({ timeout: 1 }).catch(() => undefined);
    return { database: false, workerAgeSeconds: null };
  }
  let workerAgeSeconds: number | null = null;
  try {
    const rows = await sql<{ age: number }[]>`
      select extract(epoch from (now() - beat_at))::float8 as age
      from worker_heartbeats where name = 'worker'`;
    workerAgeSeconds = rows[0]?.age ?? null;
  } catch {
    // Table missing or unreadable: treated as no heartbeat.
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
  return { database: true, workerAgeSeconds };
}
