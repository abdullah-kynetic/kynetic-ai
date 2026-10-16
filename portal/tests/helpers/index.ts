import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import postgres from "postgres";
import { generate } from "otplib";

export type Fixtures = {
  A: string; B: string; adminId: string; adminNoMfaId: string; aUser2: string; disabledId: string; clientUserA: string; clientUserB: string;
  docsA: { id: string; storage_key: string }[]; docsB: { id: string; storage_key: string }[];
  contactsB: string[]; milestonesB: string[]; scopeB: string[]; keyA: string; keyB: string; keyRevoked: string;
  adminTotp: string; pw: string; base: string; env: { FILE_SIGNING_SECRET: string; UPLOAD_DIR: string; ENCRYPTION_KEY: string }; dbOwner: string; dbApp: string;
};
export const fx: Fixtures = JSON.parse(readFileSync(path.resolve(__dirname, "../../.data/test-fixtures.json"), "utf8"));
export const base = fx.base;

/** Minimal cookie-jar HTTP client (no redirects followed — we assert on them). */
export class Client {
  jar = new Map<string, string>();
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  private store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i).trim(); const v = kv.slice(i + 1);
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v === "") this.jar.delete(k); else this.jar.set(k, v);
    }
  }
  get cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async req(p: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const res = await fetch(base + p, { redirect: "manual", ...init, headers: { cookie: this.cookie, "x-forwarded-for": this.ip, ...(init.headers ?? {}) } });
    this.store(res);
    return res;
  }
  async text(p: string, init?: RequestInit & { headers?: Record<string, string> }) { const res = await this.req(p, init); return { res, body: await res.text() }; }
  get hasSession() { return [...this.jar.keys()].some((k) => k.includes("session-token")); }

  /** Real Auth.js credentials login over HTTP. Returns the error code on failure. */
  async login(email: string, password: string, totp = ""): Promise<{ ok: boolean; code?: string }> {
    const csrf = await (await this.req("/api/auth/csrf")).json() as { csrfToken: string };
    const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, totp, redirectTo: "/", json: "true" });
    const res = await this.req("/api/auth/callback/password", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const loc = res.headers.get("location");
    const code = loc ? new URL(loc, base).searchParams.get("code") ?? undefined : undefined;
    return { ok: this.hasSession && !code, code };
  }
}

export async function loginAs(email: string, password = fx.pw, totp = "") {
  const c = new Client(); const r = await c.login(email, password, totp);
  if (!r.ok) throw new Error(`login failed for ${email}: ${r.code}`);
  return c;
}
export const totpNow = () => generate({ secret: fx.adminTotp });
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Direct DB access as owner (assertions / fixtures) or runtime role (RLS tests). */
export function owner() { return postgres(fx.dbOwner, { max: 2, onnotice: () => {} }); }
export function appRole() { return postgres(fx.dbApp, { max: 2, onnotice: () => {} }); }
export async function asAdmin<T>(sql: postgres.Sql, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => { await tx`select set_config('app.role','admin',true)`; return fn(tx); }) as Promise<T>;
}

export const signFile = (docId: string, userId: string, ttl = 600) => {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return `/api/files/${docId}?exp=${exp}&sig=${createHmac("sha256", fx.env.FILE_SIGNING_SECRET).update(`${docId}.${userId}.${exp}`).digest("hex")}`;
};
