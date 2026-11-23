import { describe, expect, it } from 'vitest';
import { TOOLS } from '../../../mcp/tools';
import {
  checkArguments,
  configFromEnv,
  handleRequest,
  type ServerConfig
} from '../../../mcp/server';

const TOKEN_A = 'tok_client_a_0123456789abcdef';
const TOKEN_B = 'tok_client_b_0123456789abcdef';
const ADMIN_KEY = `kad_${'a'.repeat(16)}_${'b'.repeat(64)}`;

type Call = { url: string; init: RequestInit };

function setup(status = 200, body = '{"ok":true}') {
  const calls: Call[] = [];
  const fetchMock = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  const cfg: ServerConfig = {
    portalUrl: 'https://portal.example.test/',
    tokens: { 'client-a': TOKEN_A, 'client-b': TOKEN_B },
    fetch: fetchMock
  };
  return { cfg, calls };
}

const call = (cfg: ServerConfig, name: string, args: Record<string, unknown>) =>
  handleRequest(cfg, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args }
  }) as Promise<{
    result: { content: { text: string }[]; isError?: boolean };
  }>;

const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

describe('MCP server: protocol', () => {
  it('answers initialize with the tools capability and the protocol version', async () => {
    const { cfg } = setup();
    const reply = (await handleRequest(cfg, { id: 1, method: 'initialize', params: {} })) as {
      result: { protocolVersion: string; capabilities: { tools: object } };
    };
    expect(reply.result.protocolVersion).toBe('2025-06-18');
    expect(reply.result.capabilities.tools).toBeDefined();
  });

  it('lists every tool with its schema and annotations, and never a token', async () => {
    const { cfg } = setup();
    const reply = (await handleRequest(cfg, { id: 2, method: 'tools/list' })) as {
      result: { tools: { name: string; inputSchema: unknown; annotations: unknown }[] };
    };
    expect(reply.result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(JSON.stringify(reply)).not.toContain(TOKEN_A);
  });

  it('sends no reply to a notification and a JSON-RPC error for an unknown method', async () => {
    const { cfg } = setup();
    expect(
      await handleRequest(cfg, { jsonrpc: '2.0', method: 'notifications/initialized' })
    ).toBeNull();
    const reply = (await handleRequest(cfg, { id: 3, method: 'resources/list' })) as {
      error: { code: number };
    };
    expect(reply.error.code).toBe(-32601);
  });
});

describe('MCP server: tool calls', () => {
  it('list_clients returns the slugs and no tokens, without a portal call', async () => {
    const { cfg, calls } = setup();
    const res = await call(cfg, 'list_clients', {});
    expect(JSON.parse(res.result.content[0].text)).toEqual({ clients: ['client-a', 'client-b'] });
    expect(res.result.content[0].text).not.toContain(TOKEN_A);
    expect(calls).toHaveLength(0);
  });

  it('a read sends the client token, fills the path and skips the client argument', async () => {
    const { cfg, calls } = setup(200, '{"name":"Ada"}');
    const res = await call(cfg, 'get_contact', {
      client: 'client-a',
      id: '7b8c0d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e'
    });
    expect(res.result.isError).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://portal.example.test/api/service/contacts/7b8c0d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e'
    );
    expect(calls[0].init.method).toBe('GET');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN_A}`
    );
    expect(calls[0].init.headers as Record<string, string>).not.toHaveProperty('Idempotency-Key');
  });

  it('a write sends the Idempotency-Key header and only the body params as JSON', async () => {
    const { cfg, calls } = setup(201, '{"id":"t1"}');
    const t = tool('create_task');
    const args: Record<string, unknown> = { client: 'client-b', idempotencyKey: 'create-task-001' };
    for (const p of t.bodyParams) args[p] = p === 'dueAt' ? '2026-11-30T15:00:00Z' : 'x';
    const res = await call(cfg, 'create_task', args);
    expect(res.result.isError).toBeUndefined();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('create-task-001');
    expect(headers.Authorization).toBe(`Bearer ${TOKEN_B}`);
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([...t.bodyParams].sort());
    expect(body).not.toHaveProperty('idempotencyKey');
    expect(body).not.toHaveProperty('client');
  });

  it('refuses a client with no registered token, and makes no portal call', async () => {
    const { cfg, calls } = setup();
    const res = await call(cfg, 'list_deals', { client: 'nobody-here' });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('No portal token');
    expect(calls).toHaveLength(0);
  });

  it('refuses unknown arguments and missing required ones before any call', async () => {
    const { cfg, calls } = setup();
    const extra = await call(cfg, 'list_deals', { client: 'client-a', admin: true });
    expect(extra.result.isError).toBe(true);
    const missing = await call(cfg, 'get_deal', { client: 'client-a' });
    expect(missing.result.isError).toBe(true);
    expect(calls).toHaveLength(0);
    expect(checkArguments(tool('get_deal'), { client: 'client-a', id: 'x' })).toBeNull();
  });

  it('reports a portal error status as a tool error without echoing the token', async () => {
    const { cfg } = setup(403, 'forbidden');
    const res = await call(cfg, 'list_tasks', { client: 'client-a' });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toBe('Portal returned 403: forbidden');
    expect(res.result.content[0].text).not.toContain(TOKEN_A);
  });

  it('get_kpi_summary calls each listed client with its own token', async () => {
    const { cfg, calls } = setup(200, '{"rows":[]}');
    const res = await call(cfg, 'get_kpi_summary', {
      clients: ['client-a', 'client-b'],
      from: '2026-11-01',
      to: '2026-11-07'
    });
    expect(res.result.isError).toBeUndefined();
    expect(calls.map((c) => (c.init.headers as Record<string, string>).Authorization)).toEqual([
      `Bearer ${TOKEN_A}`,
      `Bearer ${TOKEN_B}`
    ]);
    expect(calls[0].url).toContain('from=2026-11-01');
    expect(calls[0].url).not.toContain('clients=');
  });
});

describe('MCP server: admin key', () => {
  const withAdmin = (cfg: ServerConfig): ServerConfig => ({ ...cfg, adminKey: ADMIN_KEY });

  it('a client with no token uses the admin key and names the client in the header', async () => {
    const { cfg, calls } = setup();
    const res = await call(withAdmin(cfg), 'list_deals', { client: 'new-client' });
    expect(res.result.isError).toBeUndefined();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${ADMIN_KEY}`);
    expect(headers['X-Kynetic-Client']).toBe('new-client');
  });

  it('a registered client token still wins over the admin key', async () => {
    const { cfg, calls } = setup();
    await call(withAdmin(cfg), 'list_deals', { client: 'client-a' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN_A}`);
    expect(headers).not.toHaveProperty('X-Kynetic-Client');
  });

  it('a platform tool sends the admin key with no client header, and refuses without one', async () => {
    const platform = TOOLS.find((t) => t.auth === 'platform');
    if (!platform) return;
    const { cfg, calls } = setup();
    const refused = await call(cfg, platform.name, {});
    expect(refused.result.isError).toBe(true);
    expect(refused.result.content[0].text).toContain('KYNETIC_MCP_ADMIN_KEY');
    expect(calls).toHaveLength(0);
  });

  it('never puts the admin key in a result or an error', async () => {
    const { cfg } = setup(500, 'boom');
    const res = await call(withAdmin(cfg), 'list_deals', { client: 'new-client' });
    expect(JSON.stringify(res)).not.toContain(ADMIN_KEY);
  });
});

describe('MCP server: configuration', () => {
  it('reads the admin key and refuses a malformed one without printing it', () => {
    expect(configFromEnv({ KYNETIC_MCP_ADMIN_KEY: ADMIN_KEY }).adminKey).toBe(ADMIN_KEY);
    expect(configFromEnv({}).adminKey).toBeUndefined();
    let message = '';
    try {
      configFromEnv({ KYNETIC_MCP_ADMIN_KEY: 'kad_nope_secretvalue' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('not a valid admin key');
    expect(message).not.toContain('secretvalue');
  });

  it('reads the portal URL and the token registry from the environment', () => {
    const cfg = configFromEnv({
      KYNETIC_PORTAL_URL: 'https://p.example.test',
      KYNETIC_MCP_TOKENS: JSON.stringify({ 'client-a': TOKEN_A })
    });
    expect(cfg.portalUrl).toBe('https://p.example.test');
    expect(cfg.tokens).toEqual({ 'client-a': TOKEN_A });
  });

  it('refuses a malformed registry instead of starting half-configured', () => {
    expect(() => configFromEnv({ KYNETIC_MCP_TOKENS: '{nope' })).toThrow('not valid JSON');
    expect(() => configFromEnv({ KYNETIC_MCP_TOKENS: '[]' })).toThrow('JSON object');
    expect(() =>
      configFromEnv({ KYNETIC_MCP_TOKENS: JSON.stringify({ 'Bad Slug': TOKEN_A }) })
    ).toThrow('not valid');
    expect(() =>
      configFromEnv({ KYNETIC_MCP_TOKENS: JSON.stringify({ 'client-a': 'short' }) })
    ).toThrow('too short');
  });
});
