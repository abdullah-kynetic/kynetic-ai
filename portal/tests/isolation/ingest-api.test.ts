import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { asAdmin, base, fx, owner } from "../helpers";

const today = new Date().toISOString().slice(0, 10);
const row = (date: string, leads = 5) => ({ date, leads, calls: 7, bookings: 2, minutes_used: 12.5, avg_speed_to_lead_sec: 21.5 });
const post = (key: string | null, body: unknown, extra: Record<string, string> = {}) =>
  fetch(`${base}/api/ingest/results`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });
async function count(clientId: string, date: string) {
  const sql = owner();
  const r = await asAdmin(sql, (tx) => tx`select leads from daily_results where client_id = ${clientId} and date = ${date}`);
  await sql.end();
  return r;
}

describe("ingest API", () => {
  it("rejects missing, malformed, wrong and revoked keys", async () => {
    expect((await post(null, { rows: [row(today)] })).status).toBe(401);
    expect((await post("garbage", { rows: [row(today)] })).status).toBe(401);
    expect((await post(fx.keyA.slice(0, -3) + "xxx", { rows: [row(today)] })).status).toBe(401);
    expect((await post(fx.keyRevoked, { rows: [row(today)] })).status).toBe(401);
  });

  it("A's key with client_id of B in the body → 400, B unchanged", async () => {
    const date = "2031-01-01";
    const res = await post(fx.keyA, { rows: [{ ...row(date), client_id: fx.B }] });
    expect(res.status).toBe(400);
    expect(await count(fx.B, date)).toHaveLength(0);
    const res2 = await post(fx.keyA, { client_id: fx.B, rows: [row(date)] });
    expect(res2.status).toBe(400);
    expect(await count(fx.B, date)).toHaveLength(0);
  });

  it("A's key writes only A's rows (upsert, idempotent)", async () => {
    const date = "2031-01-02";
    expect((await post(fx.keyA, { rows: [row(date, 5)] })).status).toBe(200);
    expect((await post(fx.keyA, { rows: [row(date, 9)] })).status).toBe(200);
    const a = await count(fx.A, date);
    expect(a).toHaveLength(1);
    expect(a[0].leads).toBe(9);
    expect(await count(fx.B, date)).toHaveLength(0);
  });

  it("B's key writes only B's rows", async () => {
    const date = "2031-01-03";
    expect((await post(fx.keyB, { rows: [row(date)] })).status).toBe(200);
    expect(await count(fx.B, date)).toHaveLength(1);
    expect(await count(fx.A, date)).toHaveLength(0);
  });

  it("validates payloads (bad date, negative, too many rows, bad JSON)", async () => {
    expect((await post(fx.keyA, { rows: [{ ...row("01/02/2031") }] })).status).toBe(400);
    expect((await post(fx.keyA, { rows: [{ ...row(today), leads: -1 }] })).status).toBe(400);
    expect((await post(fx.keyA, { rows: Array.from({ length: 401 }, (_, i) => row(`2032-01-${String((i % 28) + 1).padStart(2, "0")}`)) })).status).toBe(400);
    expect((await post(fx.keyA, "{not json")).status).toBe(400);
  });

  it("HMAC signature: bad → 401, correct → 200", async () => {
    const body = JSON.stringify({ rows: [row("2031-01-04")] });
    expect((await post(fx.keyA, body, { "x-kynetic-signature": "sha256=" + "0".repeat(64) })).status).toBe(401);
    const sig = createHmac("sha256", fx.keyA).update(body).digest("hex");
    expect((await post(fx.keyA, body, { "x-kynetic-signature": `sha256=${sig}` })).status).toBe(200);
  });
});
