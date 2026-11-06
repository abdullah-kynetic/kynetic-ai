import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const workflow = JSON.parse(readFileSync('../n8n/workflows/dev/sys-sandbox-dispatch.json', 'utf8'));
const codeOf = (name: string) =>
  workflow.nodes.find((n: { name: string }) => n.name === name).parameters.jsCode as string;
const run = (name: string, json: Record<string, unknown>) =>
  runInNewContext(`(function(){ ${codeOf(name)} })()`, {
    $input: { all: () => [{ json }] },
    Intl,
    Date,
    Math,
    Number,
    String,
    Object
  })[0].json;

const NOW = '2026-11-10T18:00:00Z'; // 10:00 America/Los_Angeles, 12:00 Chicago
const base = () => ({
  tenant_id: 'tenant_fake_a',
  environment: 'sandbox',
  system: 'alex',
  conversation_id: 'conv_1',
  channel: 'sms',
  now: NOW,
  contact: {
    timezone: 'America/Los_Angeles',
    owner_state: 'TX',
    service_state: 'TX',
    consent: { channels: ['sms', 'phone_call'] },
    opted_out: {}
  },
  lease: null,
  config: { active: true, enabled: { sms: true, voice: true, email: true } }
});
const decide = (mut: (i: ReturnType<typeof base>) => void = () => {}) => {
  const i = base();
  mut(i);
  return run('Policy decide', i).policy;
};

describe('policy-decide (sandbox, pure)', () => {
  it('allows when every check passes', () => {
    expect(decide().decision).toBe('allow');
  });
  it('suppresses opted-out contact on that channel (STOP wins over consent)', () => {
    const p = decide((i) => (i.contact.opted_out = { sms: true }));
    expect(p).toMatchObject({ decision: 'suppress', reason: 'opted_out' });
    expect(decide((i) => (i.contact.opted_out = { sms: true })).rule).toBe('safety.opt_out');
  });
  it('suppresses global/tenant suppression and DNC (AM-1 style label)', () => {
    expect(decide((i) => ((i.contact as any).suppressed_global = true)).reason).toBe('suppressed');
    expect(decide((i) => ((i.contact as any).dnc = true)).reason).toBe('dnc');
  });
  it('evaluates owner state, not service address state', () => {
    expect(decide((i) => (i.contact.owner_state = 'FL')).reason).toBe('owner_ineligible');
    expect(decide((i) => (i.contact.owner_state = 'ok')).reason).toBe('owner_ineligible');
    // FL service address with a TX owner is eligible.
    expect(decide((i) => (i.contact.service_state = 'FL')).decision).toBe('allow');
    expect(decide((i) => (i.contact.owner_state = '')).decision).toBe('human_review');
  });
  it('restrictive consent default', () => {
    expect(decide((i) => (i.contact.consent = { channels: [] })).reason).toBe('no_consent');
  });
  it('defers while another system holds an unexpired lease; same conversation passes', () => {
    const lease = { system: 'nurture', conversation_id: 'x', expires_at: '2026-11-10T18:10:00Z' };
    const p = decide((i) => ((i as any).lease = lease));
    expect(p).toMatchObject({ decision: 'defer', reason: 'lease_held', next_eligible_at: lease.expires_at });
    expect(decide((i) => ((i as any).lease = { ...lease, expires_at: '2026-11-10T17:59:00Z' })).decision).toBe('allow');
    expect(decide((i) => ((i as any).lease = { system: 'alex', conversation_id: 'conv_1', expires_at: lease.expires_at })).decision).toBe('allow');
  });
  it('human-owned defers; inactive tenant / disabled channel / unapproved production suppress', () => {
    expect(decide((i) => ((i.contact as any).human_owned = true)).reason).toBe('human_owned');
    expect(decide((i) => (i.config.active = false)).reason).toBe('tenant_inactive');
    expect(decide((i) => (i.config.enabled.sms = false)).reason).toBe('channel_disabled');
    expect(decide((i) => (i.environment = 'production')).reason).toBe('production_not_approved');
  });
  it('quiet hours use the contact timezone and report next eligible time', () => {
    // 07:00Z is 23:00 in Los Angeles (quiet) but 16:00 in Tokyo (allowed).
    const p = decide((i) => ((i as any).now = '2026-11-10T07:00:00Z')); // 23:00 LA
    expect(p).toMatchObject({ decision: 'defer', reason: 'quiet_hours' });
    expect(p.next_eligible_at).toBe('2026-11-10T16:00:00.000Z'); // 08:00 PST
    // Same instant is daytime for a contact in a different timezone.
    expect(decide((i) => { (i as any).now = '2026-11-10T07:00:00Z'; i.contact.timezone = 'Asia/Tokyo'; }).decision).toBe('allow');
  });
  it('DST: before and after the US fall-back boundary map to correct local hour', () => {
    // 2026-11-01 fall back. 15:00Z = 07:00 PST (after change) -> quiet; 14:00Z = 07:00 PDT earlier day equivalent -> quiet
    expect(decide((i) => ((i as any).now = '2026-11-01T15:00:00Z')).reason).toBe('quiet_hours');
    expect(decide((i) => ((i as any).now = '2026-11-01T16:00:00Z')).decision).toBe('allow'); // 08:00 PST
  });
  it('unknown or invalid timezone needs human review, never sends', () => {
    expect(decide((i) => ((i.contact as any).timezone = undefined)).decision).toBe('human_review');
    expect(decide((i) => (i.contact.timezone = 'Not/AZone')).decision).toBe('human_review');
  });
  it('invalid input is human_review', () => {
    expect(decide((i) => ((i as any).channel = 'fax')).reason).toBe('invalid_input');
  });
});

const sink = (json: Record<string, unknown>) => run('Sink send (no external effect)', json).sink;
const cmd = (over: Record<string, unknown> = {}) => ({
  channel: 'sms',
  to: '+15550100142',
  body: 'hello',
  tenant_id: 'tenant_fake_a',
  idempotency_key: 'k1',
  ...over
});

describe('sink-send (transport-layer dry run)', () => {
  it('captures with a stable fake id and no external effect', () => {
    const a = sink({ command: cmd(), policy: { decision: 'allow' } });
    const b = sink({ command: cmd(), policy: { decision: 'allow' } });
    expect(a).toMatchObject({ status: 'captured', external_effect: false, segments: 1 });
    expect(a.provider_id).toBe(b.provider_id);
    expect(sink({ command: cmd({ idempotency_key: 'k2' }) }).provider_id).not.toBe(a.provider_id);
  });
  it('rejects non-test recipients even when policy allowed', () => {
    expect(sink({ command: cmd({ to: '+14155550123' }), policy: { decision: 'allow' } }).status).toBe('rejected_non_test_recipient');
    expect(sink({ command: cmd({ channel: 'email', to: 'real@example.com' }) }).status).toBe('rejected_non_test_recipient');
    expect(sink({ command: cmd({ channel: 'email', to: 'a@invalid.example' }) }).status).toBe('captured');
  });
  it('blocks when policy did not allow and requires an idempotency key', () => {
    expect(sink({ command: cmd(), policy: { decision: 'suppress', reason: 'opted_out' } })).toMatchObject({ status: 'blocked_by_policy', reason: 'opted_out' });
    expect(() => sink({ command: cmd({ idempotency_key: undefined }) })).toThrow('idempotency_key');
  });
  it('counts SMS segments', () => {
    expect(sink({ command: cmd({ body: 'x'.repeat(161) }) }).segments).toBe(2);
  });
});

describe('shared schemas', () => {
  it('parse and declare the proposed version ids', () => {
    for (const f of ['canonical-event', 'policy-decision']) {
      const s = JSON.parse(readFileSync(`../templates/shared/schemas/${f}.schema.json`, 'utf8'));
      expect(s.$id).toContain('1.0-proposed');
      expect(Array.isArray(s.required)).toBe(true);
    }
  });
});
