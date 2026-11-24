import { describe, expect, it } from "vitest";
import {
  handleHttp,
  httpConfigFromEnv,
  type HttpConfig,
} from "../../../mcp/http-handler";

const ACCESS = "a".repeat(40);
const ADMIN_KEY = `kad_${"a".repeat(16)}_${"b".repeat(64)}`;
const cfg = (over: Partial<HttpConfig> = {}): HttpConfig => ({
  server: {
    portalUrl: "https://portal.example.test",
    tokens: {},
    adminKey: ADMIN_KEY,
  },
  accessToken: ACCESS,
  ...over,
});
const post = (
  body: unknown,
  headers: Record<string, string> = {},
  path = "/mcp",
) =>
  new Request(`https://mcp.example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const auth = { authorization: `Bearer ${ACCESS}` };

describe("mcp http transport", () => {
  it("refuses a missing or wrong token and never echoes secrets", async () => {
    for (const h of [
      {},
      { authorization: "Bearer nope" },
      { authorization: `Bearer ${ADMIN_KEY}` },
    ]) {
      const res = await handleHttp(
        cfg(),
        post({ jsonrpc: "2.0", id: 1, method: "ping" }, h),
      );
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain(ACCESS);
    }
  });

  it("answers initialize, tools/list and ping with the token", async () => {
    const init = await handleHttp(
      cfg(),
      post({ jsonrpc: "2.0", id: 1, method: "initialize" }, auth),
    );
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe("kynetic-portal");
    const list = await handleHttp(
      cfg(),
      post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, auth),
    );
    expect((await list.json()).result.tools.length).toBeGreaterThan(100);
  });

  it("returns 202 for a notification and an array for a batch", async () => {
    const note = await handleHttp(
      cfg(),
      post({ jsonrpc: "2.0", method: "notifications/initialized" }, auth),
    );
    expect(note.status).toBe(202);
    const batch = await handleHttp(
      cfg(),
      post(
        [
          { jsonrpc: "2.0", id: 1, method: "ping" },
          { jsonrpc: "2.0", id: 2, method: "ping" },
        ],
        auth,
      ),
    );
    expect(await batch.json()).toHaveLength(2);
  });

  it("rejects bad JSON, GET, and oversized bodies", async () => {
    expect((await handleHttp(cfg(), post("{not json", auth))).status).toBe(400);
    const get = await handleHttp(
      cfg(),
      new Request("https://mcp.example.test/mcp", { headers: auth }),
    );
    expect(get.status).toBe(405);
    expect(
      (
        await handleHttp(
          cfg({ maxBodyBytes: 10 }),
          post({ jsonrpc: "2.0", id: 1, method: "ping" }, auth),
        )
      ).status,
    ).toBe(413);
  });

  it("accepts the path token only when allowed", async () => {
    const body = { jsonrpc: "2.0", id: 1, method: "ping" };
    expect(
      (await handleHttp(cfg(), post(body, {}, `/mcp/${ACCESS}`))).status,
    ).toBe(401);
    expect(
      (
        await handleHttp(
          cfg({ allowPathToken: true }),
          post(body, {}, `/mcp/${ACCESS}`),
        )
      ).status,
    ).toBe(200);
  });

  it("serves /health without a token and 404s elsewhere", async () => {
    expect(
      (await handleHttp(cfg(), new Request("https://mcp.example.test/health")))
        .status,
    ).toBe(200);
    expect(
      (await handleHttp(cfg(), new Request("https://mcp.example.test/other")))
        .status,
    ).toBe(404);
  });

  it("requires a long access token that is not the admin key", () => {
    const server = cfg().server;
    expect(() => httpConfigFromEnv({}, server)).toThrow();
    expect(() =>
      httpConfigFromEnv({ KYNETIC_MCP_ACCESS_TOKEN: "short" }, server),
    ).toThrow();
    expect(() =>
      httpConfigFromEnv(
        {
          KYNETIC_MCP_ACCESS_TOKEN: ADMIN_KEY,
          KYNETIC_MCP_ADMIN_KEY: ADMIN_KEY,
        },
        server,
      ),
    ).toThrow();
    expect(
      httpConfigFromEnv({ KYNETIC_MCP_ACCESS_TOKEN: ACCESS }, server)
        .allowPathToken,
    ).toBe(false);
  });
});
