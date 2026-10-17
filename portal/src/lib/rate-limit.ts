import "server-only";
import { sql } from "drizzle-orm";
import { withScope } from "./db/scoped";

/**
 * Fixed-window counter stored in Postgres (survives restarts, shared across instances).
 * Returns true when the call is allowed.
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const rows = await withScope({ role: "system" }, (tx) =>
    tx.execute<{ count: number }>(sql`
      insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
      on conflict (key) do update set
        count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
      returning count`),
  );
  return Number(rows[0]?.count ?? 0) <= limit;
}

/** Caddy sets X-Forwarded-For; take the left-most (client) address. */
export function ipFrom(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  return ipFrom(await headers());
}
