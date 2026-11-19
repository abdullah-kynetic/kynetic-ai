import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { TOOLS, type ToolDefinition } from "./tools";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 4;
const MAX_PER_MINUTE = 120;

type Registry = Map<string, string>;

/** The registry contains environment variable names, never token values. */
export function loadConfig(env: NodeJS.ProcessEnv): { base: URL; registry: Registry } {
  const base = new URL(env.KYNETIC_PORTAL_URL ?? "");
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    !(
      base.protocol === "https:" ||
      (base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
    )
  ) {
    throw new Error("Invalid portal URL");
  }
  const raw: unknown = JSON.parse(env.KYNETIC_CLIENTS ?? "{}");
  if (!raw || Array.isArray(raw) || typeof raw !== "object")
    throw new Error("Invalid client registry");
  const registry: Registry = new Map();
  for (const [slug, variable] of Object.entries(raw)) {
    if (
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug) ||
      typeof variable !== "string" ||
      !/^KYNETIC_TOKEN_[A-Z0-9_]+$/.test(variable) ||
      !env[variable] ||
      /[\r\n]/.test(env[variable]!)
    ) {
      throw new Error("Invalid client registry");
    }
    registry.set(slug, env[variable]!);
  }
  if (!registry.size || new Set(registry.values()).size !== registry.size)
    throw new Error("Invalid client registry");
  return { base, registry };
}

export function createHandler(
  base: URL,
  registry: Registry,
  fetcher: (input: URL, init: RequestInit) => Promise<Response> = fetch,
) {
  const ajv = new Ajv({ strict: false, allErrors: false, allowUnionTypes: true });
  addFormats(ajv);
  const validators = new Map(TOOLS.map((tool) => [tool.name, ajv.compile(tool.inputSchema)]));
  let concurrent = 0;
  let recent: number[] = [];
  const redact = (value: unknown): unknown => {
    if (typeof value === "string") {
      for (const token of registry.values())
        value = (value as string).split(token).join("[REDACTED]");
      return value;
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [redact(key), redact(item)]),
      );
    return value;
  };
  async function request(tool: ToolDefinition, args: Record<string, unknown>, client: string) {
    const token = registry.get(client);
    if (!token) throw new Error("Unknown client");
    let path = tool.route!.path;
    for (const key of tool.pathParams)
      path = path.replace(`{${key}}`, encodeURIComponent(String(args[key])));
    const url = new URL(path, base);
    for (const key of tool.queryParams)
      if (args[key] !== undefined) url.searchParams.set(key, String(args[key]));
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    };
    let body: string | undefined;
    if (tool.access === "write") {
      headers["content-type"] = "application/json";
      headers["idempotency-key"] = String(args.idempotencyKey);
      body = JSON.stringify(
        Object.fromEntries(
          tool.bodyParams.filter((key) => args[key] !== undefined).map((key) => [key, args[key]]),
        ),
      );
    }
    let response: Response;
    try {
      response = await fetcher(url, {
        method: tool.route!.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Portal request failed (HTTP ${response.status})`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Invalid portal response");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error("Portal response too large");
        }
        chunks.push(value);
      }
      const data: unknown = redact(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      return { data, replayed: response.headers.get("idempotent-replay") === "true" };
    } catch (error) {
      if (
        error instanceof Error &&
        /^(Portal request failed \(HTTP \d+\)|Invalid portal response|Portal response too large)$/.test(
          error.message,
        )
      )
        throw error;
      throw new Error("Portal request failed");
    }
  }
  return async (name: string, args: Record<string, unknown>) => {
    const tool = TOOLS.find((item) => item.name === name);
    if (!tool || !validators.get(name)!(args)) throw new Error("Invalid tool or arguments");
    if (name === "update_task" && !tool.bodyParams.some((key) => args[key] !== undefined))
      throw new Error("Invalid tool or arguments");
    if (name === "list_clients") return { clients: [...registry.keys()].sort() };
    const clients =
      name === "get_kpi_summary" ? (args.clients as string[]) : [args.client as string];
    if (clients.some((client) => !registry.has(client))) throw new Error("Unknown client");
    const now = Date.now();
    recent = recent.filter((time) => time > now - 60_000);
    if (concurrent >= MAX_CONCURRENT || recent.length + clients.length > MAX_PER_MINUTE)
      throw new Error("Request limit exceeded");
    concurrent++;
    recent.push(...clients.map(() => now));
    try {
      if (name === "get_kpi_summary") {
        // Sequential requests preserve the global bound and fail the whole comparison on any error.
        const results = [];
        for (const client of clients)
          results.push({ client, ...(await request(tool, args, client)) });
        return { clients: results };
      }
      return await request(tool, args, clients[0]!);
    } finally {
      concurrent--;
    }
  };
}

export function createServer(base: URL, registry: Registry) {
  const server = new Server(
    { name: "kynetic-portal", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  const call = createHandler(base, registry);
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      annotations,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    try {
      const result = await call(params.name, params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      return { isError: true, content: [{ type: "text", text: message }] };
    }
  });
  return server;
}

if (import.meta.main) {
  try {
    const { base, registry } = loadConfig(process.env);
    await createServer(base, registry).connect(new StdioServerTransport());
  } catch {
    console.error("MCP server configuration or startup failed");
    process.exitCode = 1;
  }
}
