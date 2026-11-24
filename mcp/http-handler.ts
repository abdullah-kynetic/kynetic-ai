// MCP over HTTP (Streamable HTTP, JSON responses only, no sessions, no SSE). One POST carries one JSON-RPC
// message or a batch. Access is guarded by a single owner access token that is separate from the admin key:
// the admin key never leaves the server, the access token is what a caller presents.

import { timingSafeEqual } from "node:crypto";
import { handleRequest, type ServerConfig } from "./server";

export type HttpConfig = {
  server: ServerConfig;
  /** The secret a caller must present. At least 32 characters. */
  accessToken: string;
  /** When true, `/mcp/<token>` also works, for clients that cannot send headers. The token then lands in URLs and logs. */
  allowPathToken?: boolean;
  /** Largest request body in bytes. */
  maxBodyBytes?: number;
};

const MAX_BODY = 1_000_000;
const json = (
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...extra,
    },
  });

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // Compare equal-length buffers in constant time; a length mismatch is already a failure.
  return x.length === y.length && timingSafeEqual(x, y);
}

export function httpConfigFromEnv(
  env: Record<string, string | undefined>,
  server: ServerConfig,
): HttpConfig {
  const accessToken = env.KYNETIC_MCP_ACCESS_TOKEN?.trim() ?? "";
  if (accessToken.length < 32) {
    throw new Error(
      "KYNETIC_MCP_ACCESS_TOKEN is required and must be at least 32 characters.",
    );
  }
  if (accessToken === env.KYNETIC_MCP_ADMIN_KEY?.trim()) {
    throw new Error("KYNETIC_MCP_ACCESS_TOKEN must not be the admin key.");
  }
  return {
    server,
    accessToken,
    allowPathToken: env.KYNETIC_MCP_ALLOW_PATH_TOKEN === "1",
  };
}

export async function handleHttp(
  cfg: HttpConfig,
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/health") return json(200, { status: "ok" });

  const pathToken = url.pathname.startsWith("/mcp/")
    ? decodeURIComponent(url.pathname.slice(5))
    : null;
  if (url.pathname !== "/mcp" && pathToken === null)
    return json(404, { error: "not_found" });

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const presented =
    bearer || (cfg.allowPathToken && pathToken ? pathToken : "");
  if (!presented || !sameSecret(presented, cfg.accessToken)) {
    return json(
      401,
      { error: "unauthorized" },
      { "www-authenticate": "Bearer" },
    );
  }

  if (req.method === "DELETE") return new Response(null, { status: 200 });
  if (req.method !== "POST")
    return json(
      405,
      { error: "method_not_allowed" },
      { allow: "POST, DELETE" },
    );

  const raw = await req.text();
  if (raw.length > (cfg.maxBodyBytes ?? MAX_BODY))
    return json(413, { error: "too_large" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  if (messages.length === 0 || messages.length > 50) {
    return json(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid request" },
    });
  }
  const replies: object[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") {
      replies.push({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid request" },
      });
      continue;
    }
    const reply = await handleRequest(
      cfg.server,
      m as Parameters<typeof handleRequest>[1],
    );
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return json(200, Array.isArray(parsed) ? replies : replies[0]);
}
