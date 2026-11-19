import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHandler, loadConfig } from "./server";
import { TOOLS } from "./tools";

const alphaToken = "synthetic-alpha-token";
const betaToken = "synthetic-beta-token";
const alphaId = "11111111-1111-4111-8111-111111111111";
const betaId = "22222222-2222-4222-8222-222222222222";
let portal: ReturnType<typeof Bun.serve>;
let client: Client;
let transport: StdioClientTransport;
const requests: {
  tenant: string;
  path: string;
  method: string;
  query: string;
  body: string;
  key: string | null;
}[] = [];
const writes = new Map<string, { signature: string; body: object }>();
let effects = 0;
let outbound = 0;

beforeAll(async () => {
  portal = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const token = req.headers.get("authorization");
      const tenant =
        token === `Bearer ${alphaToken}`
          ? "alpha"
          : token === `Bearer ${betaToken}`
            ? "beta"
            : null;
      if (!tenant) return Response.json({ error: "unauthorized" }, { status: 401 });
      const body = await req.text();
      const key = req.headers.get("idempotency-key");
      requests.push({
        tenant,
        path: url.pathname,
        method: req.method,
        query: url.search,
        body,
        key,
      });
      if (url.pathname.includes("/send") && url.pathname !== "/api/service/send-state") outbound++;
      if (
        url.pathname.includes("/contacts/") &&
        !url.pathname.includes(tenant === "alpha" ? alphaId : betaId)
      )
        return Response.json({ error: "not_found" }, { status: 404 });
      if (req.method !== "GET") {
        const index = `${tenant}:${key}`;
        const signature = `${req.method}:${url.pathname}:${body}`;
        const prior = writes.get(index);
        if (prior && prior.signature !== signature)
          return Response.json({ error: "conflict" }, { status: 409 });
        if (prior) return Response.json(prior.body, { headers: { "Idempotent-Replay": "true" } });
        effects++;
        const result = { ok: true, tenant, effect: effects };
        writes.set(index, { signature, body: result });
        return Response.json(result);
      }
      return Response.json({
        ok: true,
        data: {
          tenant,
          nextCursor: "opaque",
          days: [{ day: "2026-01-01", leads: tenant === "alpha" ? 1 : 2 }],
        },
      });
    },
  });
  transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "dist/server.js"],
    cwd: import.meta.dir,
    env: {
      PATH: process.env.PATH!,
      KYNETIC_PORTAL_URL: `http://127.0.0.1:${portal.port}`,
      KYNETIC_CLIENTS: JSON.stringify({ alpha: "KYNETIC_TOKEN_ALPHA", beta: "KYNETIC_TOKEN_BETA" }),
      KYNETIC_TOKEN_ALPHA: alphaToken,
      KYNETIC_TOKEN_BETA: betaToken,
    },
  });
  client = new Client({ name: "synthetic-test", version: "1" });
  await client.connect(transport);
});
afterAll(async () => {
  await client.close();
  portal.stop(true);
});
const call = (name: string, args: Record<string, unknown>) =>
  client.callTool({ name, arguments: args });
const text = (result: Awaited<ReturnType<typeof call>>) => JSON.stringify(result);

describe("stdio protocol and portal contracts", () => {
  test("initializes and lists exactly the defined tools", async () => {
    const list = await client.listTools();
    expect(list.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(text(await call("list_clients", {}))).toContain("alpha");
  });
  test("uses the selected tenant and preserves cursor and query", async () => {
    const result = await call("search_contacts", {
      client: "alpha",
      q: "A & B",
      limit: 10,
      cursor: "opaque",
    });
    expect(text(result)).toContain("nextCursor");
    const last = requests.at(-1)!;
    expect(last.tenant).toBe("alpha");
    expect(new URLSearchParams(last.query).get("q")).toBe("A & B");
    expect(new URLSearchParams(last.query).get("cursor")).toBe("opaque");
    expect(text(await call("get_contact", { client: "beta", id: alphaId }))).toContain("HTTP 404");
    expect(text(await call("get_contact", { client: "alpha", id: alphaId }))).toContain("alpha");
  });
  test("all read routes use their declared method, path and parameters", async () => {
    for (const tool of TOOLS.filter(
      (item) => item.access === "read" && item.route && item.name !== "get_kpi_summary",
    )) {
      const args: Record<string, unknown> = { client: "alpha" };
      for (const param of tool.pathParams) args[param] = alphaId;
      const result = await call(tool.name, args);
      expect(result.isError, tool.name).not.toBe(true);
      const last = requests.at(-1)!;
      expect(last.method, tool.name).toBe("GET");
      expect(last.path, tool.name).toBe(tool.route!.path.replace(/\{\w+\}/g, alphaId));
      expect(last.tenant, tool.name).toBe("alpha");
    }
  });
  test("rejects unauthorized portal responses without exposing response text", async () => {
    const handler = createHandler(
      new URL(`http://127.0.0.1:${portal.port}`),
      new Map([["alpha", "synthetic-invalid-token"]]),
    );
    await expect(handler("get_client", { client: "alpha" })).rejects.toThrow("HTTP 401");
  });
  test("KPI returns each client separately and refuses unknown clients", async () => {
    const result = text(
      await call("get_kpi_summary", {
        clients: ["alpha", "beta"],
        from: "2026-01-01",
        to: "2026-01-02",
      }),
    );
    expect(result).toContain("alpha");
    expect(result).toContain("beta");
    const before = requests.length;
    expect(text(await call("get_kpi_summary", { clients: ["alpha", "unknown"] }))).toContain(
      "Unknown client",
    );
    expect(requests.length).toBe(before);
  });
  test("forwards five writes and replay, without outbound", async () => {
    const cases: [string, Record<string, unknown>, string, string][] = [
      [
        "move_deal_stage",
        { id: alphaId, stageId: betaId },
        "POST",
        `/api/service/deals/${alphaId}/stage`,
      ],
      ["create_task", { title: "test" }, "POST", "/api/service/tasks"],
      ["update_task", { id: alphaId, title: "edit" }, "PATCH", `/api/service/tasks/${alphaId}`],
      ["add_note", { contactId: alphaId, body: "note" }, "POST", "/api/service/notes"],
      [
        "log_call_outcome",
        { contactId: alphaId, outcome: "other", calledAt: "2026-01-01T12:00:00Z" },
        "POST",
        "/api/service/call-log",
      ],
    ];
    for (const [name, input, method, path] of cases) {
      const args = { client: "alpha", idempotencyKey: `test_${name}`, ...input };
      const before = effects;
      const first = await call(name, args);
      const repeat = await call(name, args);
      expect(first.isError).not.toBe(true);
      expect(text(repeat)).toContain("replayed");
      expect(text(repeat)).toContain("true");
      expect(effects).toBe(before + 1);
      const last = requests.at(-1)!;
      expect(last.method).toBe(method);
      expect(last.path).toBe(path);
      expect(last.key).toBe(args.idempotencyKey);
      expect(JSON.parse(last.body)).toEqual(
        Object.fromEntries(Object.entries(input).filter(([key]) => key !== "id")),
      );
    }
    const conflict = await call("create_task", {
      client: "alpha",
      idempotencyKey: "test_create_task",
      title: "different",
    });
    expect(text(conflict)).toContain("HTTP 409");
    expect(outbound).toBe(0);
    expect(
      text(
        await call("update_task", { client: "alpha", id: alphaId, idempotencyKey: "another_key" }),
      ),
    ).toContain("Invalid");
  });
  test("rejects invalid inputs without portal requests", async () => {
    const before = requests.length;
    for (const args of [
      { client: "alpha", limit: 101 },
      { client: "alpha", extra: true },
      { client: "alpha", id: "bad" },
    ]) {
      expect((await call(args.id ? "get_contact" : "search_contacts", args)).isError).toBe(true);
    }
    expect(requests.length).toBe(before);
  });
});

describe("configuration and errors", () => {
  test("rejects duplicate credentials, non-local HTTP and URL credentials", () => {
    const base = {
      KYNETIC_PORTAL_URL: "https://example.test",
      KYNETIC_CLIENTS: '{"alpha":"KYNETIC_TOKEN_A","beta":"KYNETIC_TOKEN_B"}',
      KYNETIC_TOKEN_A: "same",
      KYNETIC_TOKEN_B: "same",
    };
    expect(() => loadConfig(base)).toThrow();
    expect(() =>
      loadConfig({ ...base, KYNETIC_TOKEN_B: "other", KYNETIC_PORTAL_URL: "http://example.test" }),
    ).toThrow();
    expect(() =>
      loadConfig({
        ...base,
        KYNETIC_TOKEN_B: "other",
        KYNETIC_PORTAL_URL: "https://user:pass@example.test",
      }),
    ).toThrow();
  });
  test("hides token and transport errors", async () => {
    const registry = new Map([["alpha", alphaToken]]);
    const handler = createHandler(new URL("http://localhost"), registry, async () =>
      Response.json({ token: alphaToken }),
    );
    expect(JSON.stringify(await handler("get_client", { client: "alpha" }))).not.toContain(
      alphaToken,
    );
    const failed = createHandler(new URL("http://localhost"), registry, async () => {
      throw new Error(alphaToken);
    });
    expect(failed("get_client", { client: "alpha" })).rejects.toThrow("Portal request failed");
  });
});
