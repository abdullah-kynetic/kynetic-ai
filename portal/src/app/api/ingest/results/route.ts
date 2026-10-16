import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { withScope } from "@/lib/db/scoped";
import { dailyResults, ingestKeys } from "@/lib/db/schema";
import { hmac, safeEqual, sha256 } from "@/lib/crypto";
import { hit, ipFrom } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const row = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  leads: z.number().int().min(0).max(1_000_000).default(0),
  calls: z.number().int().min(0).max(1_000_000).default(0),
  bookings: z.number().int().min(0).max(1_000_000).default(0),
  minutes_used: z.number().min(0).max(10_000_000).default(0),
  avg_speed_to_lead_sec: z.number().min(0).max(10_000_000).nullable().optional(),
}).strict(); // unknown fields (e.g. client_id) are rejected, not ignored
const body = z.object({ rows: z.array(row).min(1).max(400) }).strict();

const KEY_RE = /^kp_([A-Za-z0-9]{8})_[A-Za-z0-9_-]{20,}$/;
const err = (status: number, error: string) => Response.json({ error }, { status });

/**
 * POST /api/ingest/results — n8n pushes daily results.
 * Auth: `Authorization: Bearer kp_<prefix>_<secret>`. The key alone determines the client.
 * Optional integrity: `X-Kynetic-Signature: sha256=<hex hmac of raw body keyed by the full API key>`.
 */
export async function POST(req: Request) {
  if (!(await hit(`ingest:ip:${ipFrom(req.headers)}`, 120, 60))) return err(429, "rate_limited");
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const m = KEY_RE.exec(raw);
  if (!m) return err(401, "unauthorized");

  const key = await withScope({ role: "system" }, async (tx) => {
    const [k] = await tx.select().from(ingestKeys).where(and(eq(ingestKeys.prefix, m[1]), isNull(ingestKeys.revokedAt)));
    return k ?? null;
  });
  if (!key || !safeEqual(key.keyHash, sha256(raw))) return err(401, "unauthorized");
  if (!(await hit(`ingest:key:${key.id}`, 60, 60))) return err(429, "rate_limited");

  const text = await req.text();
  if (text.length > 256 * 1024) return err(413, "payload_too_large");
  const sigHeader = req.headers.get("x-kynetic-signature");
  if (sigHeader) {
    const expected = `sha256=${hmac(raw, text)}`;
    if (!safeEqual(expected, sigHeader.trim())) return err(401, "bad_signature");
  }
  let json: unknown;
  try { json = JSON.parse(text); } catch { return err(400, "invalid_json"); }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "invalid_body", issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });

  const clientId = key.clientId;
  const values = parsed.data.rows.map((r) => ({
    clientId, date: r.date, leads: r.leads, calls: r.calls, bookings: r.bookings,
    minutesUsed: String(r.minutes_used), avgSpeedToLeadSec: r.avg_speed_to_lead_sec == null ? null : String(r.avg_speed_to_lead_sec), updatedAt: new Date(),
  }));
  const upserted = await withScope({ role: "ingest", clientId }, async (tx) => {
    const res = await tx.insert(dailyResults).values(values).onConflictDoUpdate({
      target: [dailyResults.clientId, dailyResults.date],
      set: {
        leads: sql`excluded.leads`, calls: sql`excluded.calls`, bookings: sql`excluded.bookings`,
        minutesUsed: sql`excluded.minutes_used`, avgSpeedToLeadSec: sql`excluded.avg_speed_to_lead_sec`, updatedAt: sql`now()`,
      },
    }).returning({ id: dailyResults.id });
    await audit(tx, { clientId, action: "results.ingested", meta: { rows: res.length, keyPrefix: key.prefix } });
    return res.length;
  });
  await withScope({ role: "system" }, (tx) => tx.update(ingestKeys).set({ lastUsedAt: new Date() }).where(eq(ingestKeys.id, key.id)));
  return Response.json({ ok: true, upserted });
}
