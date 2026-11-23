// MCP server for the Kynetic portal service API. Speaks MCP over stdio (JSON-RPC 2.0, one message per
// line) with no SDK dependency. Every tool in tools.ts becomes one fetch to one /api/service/* route with
// the portal token of the chosen client. Nothing here stores a token, logs one, or puts one in a result.
//
// Config comes from the environment (see README.md): KYNETIC_PORTAL_URL, KYNETIC_MCP_TOKENS (a JSON
// object that maps each client slug to that client's own portal token) and, optionally,
// KYNETIC_MCP_ADMIN_KEY, the owner's admin key. The admin key reaches every client (named with the
// X-Kynetic-Client header) and the platform routes (no header). It is never sent to the caller.

import { TOOLS, type ToolDefinition } from './tools';

export const PROTOCOL_VERSION = '2025-06-18';
export const SERVER_INFO = { name: 'kynetic-portal', version: '0.1.0' };
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
// The portal's own limit for the X-Kynetic-Client header, which is stricter than SLUG.
const ADMIN_CLIENT_SLUG = /^[a-z0-9-]{3,40}$/;
const ADMIN_KEY = /^kad_[0-9a-f]{16}_[0-9a-f]{64}$/;
const MAX_ERROR_TEXT = 2000;

export type ServerConfig = {
  portalUrl: string;
  /** client slug -> portal service token. Never sent to the caller, never logged. */
  tokens: Record<string, string>;
  /** The owner's admin key (kad_...). Never sent to the caller, never logged. */
  adminKey?: string;
  fetch?: typeof fetch;
};

/** What one portal call is sent with: a bearer secret, plus the client the admin key acts for. */
type Credential = { bearer: string; adminClient?: string };

type Request = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const ok = (id: Request['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const rpcError = (id: Request['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message }
});
const text = (value: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {})
});

export function listTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations
  }));
}

/** Checks the arguments against the tool's closed schema: known keys only, required keys present. */
export function checkArguments(tool: ToolDefinition, args: Record<string, unknown>): string | null {
  const known = tool.inputSchema.properties;
  for (const key of Object.keys(args)) {
    if (!(key in known)) return `Unknown argument "${key}".`;
  }
  for (const key of tool.inputSchema.required) {
    if (args[key] === undefined) return `Missing required argument "${key}".`;
  }
  return null;
}

/** Builds the portal URL, query and JSON body for one tool call. Path params never reach the body. */
export function buildPortalRequest(tool: ToolDefinition, args: Record<string, unknown>, portalUrl: string) {
  if (!tool.route) throw new Error(`${tool.name} has no portal route`);
  let path = tool.route.path;
  for (const p of tool.pathParams) {
    path = path.replace(`{${p}}`, encodeURIComponent(String(args[p])));
  }
  const query = new URLSearchParams();
  for (const p of tool.queryParams) {
    if (args[p] !== undefined) query.set(p, String(args[p]));
  }
  const body: Record<string, unknown> = {};
  for (const p of tool.bodyParams) {
    if (args[p] !== undefined) body[p] = args[p];
  }
  const qs = query.toString();
  const url = `${portalUrl.replace(/\/+$/, '')}${path}${qs ? `?${qs}` : ''}`;
  return {
    method: tool.route.method,
    url,
    body: tool.route.method === 'GET' ? undefined : body,
    idempotencyKey: tool.access === 'write' ? String(args.idempotencyKey) : undefined
  };
}

async function callPortal(
  cfg: ServerConfig,
  credential: Credential,
  tool: ToolDefinition,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const doFetch = cfg.fetch ?? fetch;
  const req = buildPortalRequest(tool, args, cfg.portalUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential.bearer}`,
    Accept: 'application/json'
  };
  if (credential.adminClient) headers['X-Kynetic-Client'] = credential.adminClient;
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';
  if (req.idempotencyKey) headers['Idempotency-Key'] = req.idempotencyKey;
  const res = await doFetch(req.url, {
    method: req.method,
    headers,
    body: req.body === undefined ? undefined : JSON.stringify(req.body)
  });
  const body = await res.text();
  if (!res.ok) {
    return text(`Portal returned ${res.status}: ${body.slice(0, MAX_ERROR_TEXT)}`, true);
  }
  return text(body);
}

const NEEDS_ADMIN_KEY =
  'This tool needs the owner admin key. Set KYNETIC_MCP_ADMIN_KEY in the server environment.';

export async function callTool(
  cfg: ServerConfig,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return text(`Unknown tool "${name}".`, true);
  const problem = checkArguments(tool, args);
  if (problem) return text(problem, true);

  if (name === 'list_clients') {
    return text(JSON.stringify({ clients: Object.keys(cfg.tokens).sort() }));
  }

  if (tool.auth === 'platform') {
    if (!cfg.adminKey) return text(NEEDS_ADMIN_KEY, true);
    return callPortal(cfg, { bearer: cfg.adminKey }, tool, args);
  }

  // A registered client token wins. Without one, the admin key acts for the named client.
  const credentialFor = (slug: unknown): Credential | string => {
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      return `No portal token is registered for client "${String(slug)}". Use list_clients.`;
    }
    if (tool.auth === 'agency') {
      if (!cfg.adminKey) return NEEDS_ADMIN_KEY;
      if (!ADMIN_CLIENT_SLUG.test(slug)) return `"${slug}" is not a valid client slug for the admin key.`;
      return { bearer: cfg.adminKey, adminClient: slug };
    }
    if (cfg.tokens[slug]) return { bearer: cfg.tokens[slug] };
    if (cfg.adminKey && ADMIN_CLIENT_SLUG.test(slug)) return { bearer: cfg.adminKey, adminClient: slug };
    return `No portal token is registered for client "${slug}". Use list_clients.`;
  };

  if (name === 'get_kpi_summary') {
    if (!Array.isArray(args.clients) || args.clients.length === 0) {
      return text('"clients" must be a non-empty list of client slugs.', true);
    }
    const credentials: Credential[] = [];
    for (const slug of args.clients as unknown[]) {
      const credential = credentialFor(slug);
      if (typeof credential === 'string') return text(credential, true);
      credentials.push(credential);
    }
    const results = [];
    for (const [i, slug] of (args.clients as string[]).entries()) {
      const rest = { ...args };
      delete rest.clients;
      const res = await callPortal(cfg, credentials[i], tool, rest);
      results.push({ client: slug, isError: res.isError === true, text: res.content[0].text });
    }
    return text(JSON.stringify({ results }));
  }

  const { client, ...rest } = args;
  const credential = credentialFor(client);
  if (typeof credential === 'string') return text(credential, true);
  return callPortal(cfg, credential, tool, rest);
}

export async function handleRequest(cfg: ServerConfig, req: Request): Promise<object | null> {
  // A message without an id is a notification and gets no reply.
  if (req.id === undefined) return null;
  const id = req.id;
  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: listTools() });
    case 'tools/call': {
      const params = req.params ?? {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        return ok(id, await callTool(cfg, name, args));
      } catch {
        // The error text can carry a portal response; keep it generic so nothing secret leaks.
        return ok(id, text(`The call to ${name} failed before a portal response was read.`, true));
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${req.method ?? ''}`);
  }
}

/** Reads one JSON-RPC message per line from `input` and writes one reply per line to `output`. */
export function serveLines(
  cfg: ServerConfig,
  input: AsyncIterable<string>,
  output: (line: string) => void
): Promise<void> {
  return (async () => {
    for await (const line of input) {
      if (!line.trim()) continue;
      let req: Request;
      try {
        req = JSON.parse(line) as Request;
      } catch {
        output(JSON.stringify(rpcError(null, -32700, 'Parse error')));
        continue;
      }
      const reply = await handleRequest(cfg, req);
      if (reply) output(JSON.stringify(reply));
    }
  })();
}

/** Parses the environment. Throws on a malformed token registry so the server never starts half-configured. */
export function configFromEnv(env: Record<string, string | undefined>): ServerConfig {
  const portalUrl = env.KYNETIC_PORTAL_URL || 'https://portal.kyneticai.com';
  let parsed: unknown = {};
  if (env.KYNETIC_MCP_TOKENS) {
    try {
      parsed = JSON.parse(env.KYNETIC_MCP_TOKENS);
    } catch {
      throw new Error('KYNETIC_MCP_TOKENS is not valid JSON.');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('KYNETIC_MCP_TOKENS must be a JSON object of client slug to token.');
  }
  const tokens: Record<string, string> = {};
  for (const [slug, token] of Object.entries(parsed as Record<string, unknown>)) {
    if (!SLUG.test(slug)) throw new Error(`Client slug "${slug}" is not valid.`);
    if (typeof token !== 'string' || token.length < 16) throw new Error(`Token for "${slug}" is missing or too short.`);
    tokens[slug] = token;
  }
  const adminKey = env.KYNETIC_MCP_ADMIN_KEY?.trim();
  if (adminKey && !ADMIN_KEY.test(adminKey)) {
    throw new Error('KYNETIC_MCP_ADMIN_KEY is not a valid admin key (kad_ then 16 and 64 hex characters).');
  }
  return { portalUrl, tokens, ...(adminKey ? { adminKey } : {}) };
}
