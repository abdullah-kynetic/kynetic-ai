// Entry point for the hosted server: `bun mcp/http.ts`. Listens on KYNETIC_MCP_PORT (default 8787).
// Put it behind a TLS proxy; it never terminates TLS itself. Logs carry no tokens, keys or bodies.

import { configFromEnv } from "./server";
import { handleHttp, httpConfigFromEnv } from "./http-handler";

const server = configFromEnv(process.env);
const cfg = httpConfigFromEnv(process.env, server);
const port = Number(process.env.KYNETIC_MCP_PORT || 8787);

Bun.serve({
  port,
  hostname: process.env.KYNETIC_MCP_HOST || "0.0.0.0",
  fetch: (req) => handleHttp(cfg, req),
});
console.error(
  `kynetic-mcp listening on :${port} (admin key ${server.adminKey ? "set" : "unset"})`,
);
