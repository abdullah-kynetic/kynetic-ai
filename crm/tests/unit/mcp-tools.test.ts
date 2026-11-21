import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DATA_NOTICE,
  IDEMPOTENCY_NOTE,
  ROUTES_WITHOUT_TOOLS,
  TOOLS,
  type ToolDefinition
} from '../../../mcp/tools';
import {
  appointmentListSchema,
  callListSchema,
  callLogSchema,
  contactListSchema,
  dealListSchema,
  serviceDealStageSchema,
  serviceNoteSchema,
  serviceTaskCreateSchema,
  serviceTaskUpdateSchema,
  taskListSchema,
  SERVICE_PAGE_MAX,
  CALL_LOG_OUTCOMES,
  CALL_OUTCOMES
} from '@/server/service-api';
import { SERVICE_TOKEN_SCOPES } from '@/server/service-auth/scopes';

const API_DIR = join(process.cwd(), 'src', 'app', 'api', 'service');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? routeFiles(p) : name === 'route.ts' ? [p] : [];
  });
}

/** Every exported HTTP method of every service route, as "METHOD /api/service/path/{param}". */
function portalRoutes(): { key: string; file: string; scope: string | null }[] {
  const out: { key: string; file: string; scope: string | null }[] = [];
  for (const file of routeFiles(API_DIR)) {
    const text = readFileSync(file, 'utf8');
    const path =
      '/api/' +
      relative(join(process.cwd(), 'src', 'app', 'api'), file)
        .split(sep)
        .slice(0, -1)
        .join('/')
        .replace(/\[(\w+)\]/g, '{$1}');
    for (const m of text.matchAll(/export const (GET|POST|PATCH|PUT|DELETE) = /g)) {
      const start = text.indexOf(m[0]);
      const after = text.slice(start);
      const next = after.slice(m[0].length).search(/export const (GET|POST|PATCH|PUT|DELETE) = /);
      const block = next === -1 ? after : after.slice(0, m[0].length + next);
      const scope = /requiredScope: '([^']+)'/.exec(block)?.[1] ?? null;
      out.push({ key: `${m[1]} ${path}`, file, scope });
    }
  }
  return out;
}

const routeKey = (t: ToolDefinition) => (t.route ? `${t.route.method} ${t.route.path}` : null);
const withRoute = TOOLS.filter((t) => t.route);

describe('MCP tool definitions: shape', () => {
  it('have unique snake_case names and are plain JSON', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]{2,40}$/);
    expect(JSON.parse(JSON.stringify(TOOLS))).toEqual(TOOLS);
  });

  it('have closed input schemas whose properties are exactly the declared params', () => {
    for (const t of TOOLS) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.inputSchema.additionalProperties).toBe(false);
      const declared = new Set([...t.pathParams, ...t.queryParams, ...t.bodyParams]);
      const extra =
        t.name === 'list_clients' ? [] : t.name === 'get_kpi_summary' ? ['clients'] : ['client'];
      if (t.access === 'write') extra.push('idempotencyKey');
      expect(Object.keys(t.inputSchema.properties).sort(), t.name).toEqual(
        [...declared, ...extra].sort()
      );
      for (const r of t.inputSchema.required) {
        expect(t.inputSchema.properties[r], `${t.name}.${r}`).toBeDefined();
      }
    }
  });

  it('every tool except list_clients names the client it acts for', () => {
    for (const t of TOOLS) {
      if (t.name === 'list_clients') continue;
      const key = t.name === 'get_kpi_summary' ? 'clients' : 'client';
      expect(t.inputSchema.required, t.name).toContain(key);
    }
  });
});

describe('MCP tool definitions: scopes and routes match the portal', () => {
  it('every scope is a real service-token scope and appears in the description', () => {
    for (const t of TOOLS) {
      if (t.scope === null) {
        expect(t.route).toBeNull();
        continue;
      }
      expect(SERVICE_TOKEN_SCOPES as readonly string[], t.name).toContain(t.scope);
      expect(t.description, t.name).toContain(t.scope);
    }
  });

  it("each tool's route exists, exports that method and requires that scope", () => {
    const portal = new Map(portalRoutes().map((r) => [r.key, r]));
    for (const t of withRoute) {
      const found = portal.get(routeKey(t)!);
      expect(found, `${t.name}: ${routeKey(t)}`).toBeDefined();
      expect(found!.scope, t.name).toBe(t.scope);
    }
  });

  it('every service route has a tool or is listed as left out on purpose', () => {
    const covered = new Set([
      ...withRoute.map(routeKey),
      ...ROUTES_WITHOUT_TOOLS.map((r) => `${r.method} ${r.path}`)
    ]);
    const missing = portalRoutes()
      .map((r) => r.key)
      .filter((k) => !covered.has(k));
    expect(missing).toEqual([]);
  });

  it('left-out routes are real routes with the scope listed', () => {
    const portal = new Map(portalRoutes().map((r) => [r.key, r]));
    for (const r of ROUTES_WITHOUT_TOOLS) {
      expect(portal.get(`${r.method} ${r.path}`)?.scope).toBe(r.scope);
    }
  });

  it('path params appear in the path and use only GET, POST or PATCH', () => {
    for (const t of withRoute) {
      expect(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).toContain(t.route!.method);
      const inPath = [...t.route!.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(inPath.sort(), t.name).toEqual([...t.pathParams].sort());
    }
  });
});

describe('MCP tool definitions: inputs match the portal schemas', () => {
  const json = (s: z.ZodType) =>
    z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as {
      properties: Record<string, { enum?: unknown[] }>;
      required?: string[];
    };
  const cases: [string, z.ZodType][] = [
    ['search_contacts', contactListSchema],
    ['list_deals', dealListSchema],
    ['list_tasks', taskListSchema],
    ['list_calls', callListSchema],
    ['list_appointments', appointmentListSchema],
    ['move_deal_stage', serviceDealStageSchema],
    ['create_task', serviceTaskCreateSchema],
    ['update_task', serviceTaskUpdateSchema],
    ['add_note', serviceNoteSchema],
    ['log_call_outcome', callLogSchema]
  ];
  const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

  for (const [name, schema] of cases) {
    it(`${name} sends exactly the fields the route accepts`, () => {
      const t = tool(name);
      const s = json(schema);
      expect([...t.queryParams, ...t.bodyParams].sort()).toEqual(Object.keys(s.properties).sort());
      for (const [key, prop] of Object.entries(s.properties)) {
        const mine = t.inputSchema.properties[key] as { enum?: unknown[] };
        if (prop.enum) expect(mine.enum, `${name}.${key}`).toEqual(prop.enum);
      }
      const bodyRequired = (s.required ?? []).filter((k) => k !== 'limit');
      const mineRequired = t.inputSchema.required.filter(
        (k) => k !== 'client' && k !== 'idempotencyKey' && !t.pathParams.includes(k)
      );
      expect(mineRequired.sort(), name).toEqual(bodyRequired.sort());
    });
  }

  it('the two routes with a local query schema take the params the route declares', () => {
    expect(tool('get_contact_activities').queryParams.sort()).toEqual(['cursor', 'limit', 'types']);
    expect(tool('get_daily_metrics').queryParams.sort()).toEqual(['from', 'to']);
    expect(tool('get_kpi_summary').queryParams.sort()).toEqual(['from', 'to']);
  });

  it('page size, call outcomes and the call-log outcomes match the portal', () => {
    for (const t of TOOLS.filter((x) => x.queryParams.includes('limit'))) {
      expect((t.inputSchema.properties.limit as { maximum: number }).maximum, t.name).toBe(
        SERVICE_PAGE_MAX
      );
    }
    expect((tool('list_calls').inputSchema.properties.outcome as { enum: string[] }).enum).toEqual([
      ...CALL_OUTCOMES
    ]);
    expect(
      (tool('log_call_outcome').inputSchema.properties.outcome as { enum: string[] }).enum
    ).toEqual([...CALL_LOG_OUTCOMES]);
  });
});

describe('MCP tool definitions: safety rules', () => {
  const writes = TOOLS.filter((t) => t.access === 'write');
  const reads = TOOLS.filter((t) => t.access === 'read');

  it('every write is a non-GET call on a known route, and every read is a GET', () => {
    for (const t of writes) expect(['POST', 'PATCH', 'PUT', 'DELETE']).toContain(t.route!.method);
    for (const t of reads) expect(t.route === null || t.route.method === 'GET').toBe(true);
  });

  it('every write requires an idempotencyKey in the portal format and says how repeats behave', () => {
    for (const t of writes) {
      expect(t.inputSchema.required, t.name).toContain('idempotencyKey');
      const key = t.inputSchema.properties.idempotencyKey as { pattern: string };
      const re = new RegExp(key.pattern);
      expect(re.test('abcd1234')).toBe(true);
      expect(re.test('short')).toBe(false);
      expect(re.test('a'.repeat(129))).toBe(false);
      expect(re.test('has space 123')).toBe(false);
      expect(t.description, t.name).toContain(IDEMPOTENCY_NOTE);
      expect(t.description, t.name).toContain('Sends nothing');
    }
    for (const t of reads) expect(t.inputSchema.properties.idempotencyKey).toBeUndefined();
  });

  it('every tool that returns free text says it is data and not instructions', () => {
    for (const t of TOOLS) {
      if (t.freeText.length) expect(t.description, t.name).toContain(DATA_NOTICE);
      else expect(t.description, t.name).not.toContain(DATA_NOTICE);
    }
    expect(DATA_NOTICE).toMatch(/data/);
    expect(DATA_NOTICE).toMatch(/never as instructions/);
    for (const name of [
      'search_contacts',
      'get_contact',
      'get_contact_activities',
      'list_deals',
      'get_deal',
      'list_tasks',
      'list_pipelines',
      'get_client',
      'move_deal_stage',
      'create_task',
      'update_task'
    ]) {
      expect(TOOLS.find((t) => t.name === name)!.freeText.length, name).toBeGreaterThan(0);
    }
  });

  it('no tool can change PROVIDER_MODE or OUTBOUND_ENABLED, the two runtime flags', () => {
    // Full access (chosen 11-21) covers deletes, bulk edits and settings. These two flags stay out.
    const forbidden = /provider_?mode|outbound_?enabled/i;
    for (const t of TOOLS) {
      expect(forbidden.test(t.name), t.name).toBe(false);
      for (const key of Object.keys(t.inputSchema.properties)) {
        expect(forbidden.test(key), `${t.name}.${key}`).toBe(false);
      }
    }
    expect(TOOLS.find((t) => t.name === 'get_send_state')!.access).toBe('read');
  });

  it('the do-not-call outcome is not loggable through a tool, and consent routes have no tool', () => {
    const log = TOOLS.find((t) => t.name === 'log_call_outcome')!;
    expect((log.inputSchema.properties.outcome as { enum: string[] }).enum).not.toContain('dnc');
    // TODO(B1): the MCP tools for the C1 contact routes ship with the MCP server. When B1 lands,
    // bring this list back down to the original two routes.
    expect(ROUTES_WITHOUT_TOOLS.map((r) => r.path)).toEqual([
      '/api/service/call-results',
      '/api/service/contact-decisions',
      '/api/service/contacts/export',
      '/api/service/referrals',
      '/api/service/referrals/{id}',
      '/api/service/presence/{id}',
      '/api/service/documents',
      '/api/service/documents',
      '/api/service/documents/{id}/url',
      '/api/service/documents/{id}',
      '/api/service/notifications/read',
      '/api/service/reports',
      '/api/service/reports/{id}',
      '/api/service/reports/generate',
      '/api/service/search',
      '/api/service/settings/business',
      '/api/service/settings/hours',
      '/api/service/settings/tags',
      '/api/service/settings/tags',
      '/api/service/settings/tags',
      '/api/service/settings/tags',
      '/api/service/settings/custom-fields',
      '/api/service/settings/custom-fields',
      '/api/service/settings/custom-fields/{id}',
      '/api/service/settings/custom-fields/{id}',
      '/api/service/settings/branding',
      '/api/service/settings/alex',
      '/api/service/settings/alex',
      '/api/service/settings/automations',
      '/api/service/settings/automations/{key}',
      '/api/service/agency/prospects',
      '/api/service/agency/prospects',
      '/api/service/agency/prospects/move-to-sales',
      '/api/service/agency/leads',
      '/api/service/agency/leads',
      '/api/service/agency/deals/{id}/move',
      '/api/service/agency/stages/{id}',
      '/api/service/agency/contracts',
      '/api/service/agency/contracts',
      '/api/service/agency/contracts/{id}/mark-sent',
      '/api/service/agency/contracts/{id}/mark-signed',
      '/api/service/agency/contracts/{id}/void',
      '/api/service/agency/contracts/{id}/file',
      '/api/service/agency/finance',
      '/api/service/agency/finance/export',
      '/api/service/agency/expenses',
      '/api/service/agency/expenses/{id}',
      '/api/service/agency/expenses/{id}',
      '/api/service/agency/revenue',
      '/api/service/agency/referrals',
      '/api/service/agency/referrals/{id}/approve',
      '/api/service/agency/billing',
      '/api/service/agency/billing/invoices',
      '/api/service/agency/dialer',
      '/api/service/agency/dialer/calls',
      '/api/service/agency/dnc',
      '/api/service/agency/inbox',
      '/api/service/agency/inbox/dm',
      '/api/service/agency/campaigns',
      '/api/service/agency/campaigns',
      '/api/service/agency/campaigns/{id}/assign',
      '/api/service/agency/campaigns/{id}/stats',
      '/api/service/agency/ops',
      '/api/service/platform/clients',
      '/api/service/platform/clients',
      '/api/service/platform/clients/{id}',
      '/api/service/platform/clients/{id}/checklist',
      '/api/service/platform/clients/{id}/checklist',
      '/api/service/platform/clients/{id}/go-live',
      '/api/service/platform/clients/{id}/lifecycle',
      '/api/service/platform/clients/{id}/apply-template',
      '/api/service/platform/clients/{id}/modules',
      '/api/service/platform/clients/{id}/modules',
      '/api/service/platform/templates',
      '/api/service/platform/templates',
      '/api/service/platform/billing',
      '/api/service/platform/clients/{id}/billing',
      '/api/service/platform/clients/{id}/plan',
      '/api/service/platform/clients/{id}/billing-profile',
      '/api/service/platform/usage',
      '/api/service/platform/outbound-pause',
      '/api/service/platform/outbound-pause',
      '/api/service/platform/clients/{id}/spend-cap',
      '/api/service/platform/clients/{id}/llm-cap',
      '/api/service/platform/clients/{id}/email-flags',
      '/api/service/platform/clients/{id}/suspend',
      '/api/service/platform/webhooks/failed',
      '/api/service/platform/webhooks/{id}/replay',
      '/api/service/platform/jobs',
      '/api/service/platform/integrations/health',
      '/api/service/platform/flagged-calls',
      '/api/service/platform/flagged-calls/{id}/reviewed',
      '/api/service/platform/users',
      '/api/service/platform/users/{id}/deactivate',
      '/api/service/platform/users/{id}/reactivate',
      '/api/service/platform/users/{id}/role',
      '/api/service/platform/support',
      '/api/service/platform/support/{id}',
      '/api/service/platform/support/{id}/reply',
      '/api/service/platform/support/{id}/status',
      '/api/service/platform/audit',
      '/api/service/platform/backups',
      '/api/service/platform/backups',
      '/api/service/platform/runtime-flags',
      '/api/service/support',
      '/api/service/support',
      '/api/service/support/{id}',
      '/api/service/support/{id}/reply'
    ]);
  });

  it('read tools are idempotent and read-only; write tools are never destructive', () => {
    for (const t of reads) expect(t.annotations.readOnlyHint).toBe(true);
    for (const t of writes) {
      expect(t.annotations.readOnlyHint).toBe(false);
      expect(t.annotations.destructiveHint).toBe(false);
    }
  });
});
