import { afterAll, describe, expect, it } from "vitest";
import { appRole, fx } from "./helpers";

const sql = appRole();
afterAll(() => sql.end());
const TABLES = ["clients", "business_profiles", "contacts", "scope_items", "milestones", "documents", "daily_results", "ingest_keys", "users", "auth_tokens", "rate_limits", "audit_log", "recovery_codes"];
const as = <T>(ctx: { role: string; clientId?: string; userId?: string }, fn: (tx: typeof sql) => Promise<T>) =>
  sql.begin(async (tx) => {
    await tx`select set_config('app.role', ${ctx.role}, true), set_config('app.client_id', ${ctx.clientId ?? ""}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`;
    return fn(tx as unknown as typeof sql);
  }) as Promise<T>;

describe("RLS as the runtime role", () => {
  it("portal_app is neither superuser, owner nor BYPASSRLS", async () => {
    const [r] = await sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(r.rolsuper).toBe(false); expect(r.rolbypassrls).toBe(false);
    const owners = await sql`select tableowner from pg_tables where schemaname = 'public' and tablename = 'clients'`;
    expect(owners[0].tableowner).not.toBe("portal_app");
  });

  it("no context → zero rows in every table", async () => {
    for (const t of TABLES) expect((await sql.unsafe(`select count(*)::int n from ${t}`))[0].n, t).toBe(0);
  });

  it("client A context sees only A's rows; B-filtered queries return nothing", async () => {
    const ctx = { role: "client", clientId: fx.A, userId: fx.clientUserA };
    for (const t of ["business_profiles", "contacts", "scope_items", "milestones", "documents", "daily_results"]) {
      const rows = await as(ctx, (tx) => tx.unsafe(`select distinct client_id from ${t}`));
      expect(rows.map((r) => r.client_id), t).toEqual([fx.A]);
      expect((await as(ctx, (tx) => tx.unsafe(`select count(*)::int n from ${t} where client_id = '${fx.B}'`)))[0].n, t).toBe(0);
    }
    expect((await as(ctx, (tx) => tx`select id from clients`)).map((r) => r.id)).toEqual([fx.A]);
    expect((await as(ctx, (tx) => tx`select id from users`)).map((r) => r.id)).toEqual([fx.clientUserA]); // no member list
    for (const t of ["ingest_keys", "auth_tokens", "rate_limits", "recovery_codes"]) expect((await as(ctx, (tx) => tx.unsafe(`select count(*)::int n from ${t}`)))[0].n, t).toBe(0);
  });

  it("client context cannot write tenant tables (own or B's)", async () => {
    const ctx = { role: "client", clientId: fx.A, userId: fx.clientUserA };
    for (const c of [fx.A, fx.B]) {
      await expect(as(ctx, (tx) => tx`insert into contacts (client_id, name) values (${c}, 'x')`)).rejects.toThrow(/row-level security/);
      await expect(as(ctx, (tx) => tx`insert into milestones (client_id, phase, title) values (${c}, 'build', 'x')`)).rejects.toThrow(/row-level security/);
      await expect(as(ctx, (tx) => tx`insert into daily_results (client_id, date) values (${c}, '2040-01-01')`)).rejects.toThrow(/row-level security/);
    }
    expect((await as(ctx, (tx) => tx`update contacts set name = 'hacked' where client_id = ${fx.B} returning id`))).toHaveLength(0);
    expect((await as(ctx, (tx) => tx`delete from contacts where client_id = ${fx.B} returning id`))).toHaveLength(0);
    expect((await as(ctx, (tx) => tx`delete from contacts where client_id = ${fx.A} returning id`))).toHaveLength(0);
  });

  it("client can insert a document only into its own tenant, as itself", async () => {
    const ctx = { role: "client", clientId: fx.A, userId: fx.clientUserA };
    const ins = (c: string, role: string, by: string) => as(ctx, (tx) => tx`insert into documents (client_id, name, storage_key, mime, size, uploaded_by, uploaded_by_role) values (${c}, 't', 'k', 'text/plain', 1, ${by}, ${role}) returning id`);
    await expect(ins(fx.B, "client", fx.clientUserA)).rejects.toThrow(/row-level security/);
    await expect(ins(fx.A, "admin", fx.clientUserA)).rejects.toThrow(/row-level security/);
    await expect(ins(fx.A, "client", fx.clientUserB)).rejects.toThrow(/row-level security/);
  });

  it("client can't escalate own user row (role, client)", async () => {
    const ctx = { role: "client", clientId: fx.A, userId: fx.clientUserA };
    await expect(as(ctx, (tx) => tx`update users set role = 'admin' where id = ${fx.clientUserA}`)).rejects.toThrow(/row-level security/);
    await expect(as(ctx, (tx) => tx`update users set client_id = ${fx.B} where id = ${fx.clientUserA}`)).rejects.toThrow(/row-level security/);
  });

  it("ingest scope writes only its own client's results and reads nothing else", async () => {
    const ctx = { role: "ingest", clientId: fx.A };
    await as(ctx, (tx) => tx`insert into daily_results (client_id, date) values (${fx.A}, '2040-02-02')`);
    await expect(as(ctx, (tx) => tx`insert into daily_results (client_id, date) values (${fx.B}, '2040-02-02')`)).rejects.toThrow(/row-level security/);
    for (const t of ["contacts", "documents", "users", "milestones"]) expect((await as(ctx, (tx) => tx.unsafe(`select count(*)::int n from ${t}`)))[0].n, t).toBe(0);
  });

  it("unknown role strings get nothing", async () => {
    for (const role of ["", "root", "ADMIN", "admin ", "client' or '1'='1"]) {
      expect((await as({ role }, (tx) => tx`select count(*)::int n from clients`))[0].n, role).toBe(0);
    }
  });
});
