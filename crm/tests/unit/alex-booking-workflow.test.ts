import { createHmac, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// P6-6 evidence in the repo: the drafts are inactive, hold no secret, wire together, and the two Code
// nodes behave. Whether n8n itself shows anything active is checked on the instance, after a yes.
const dir = '../n8n/drafts/alex-lead-to-booking';
const load = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
const booking = load('alex-lead-to-booking.json');
const alert = load('alex-error-alert.json');
const codeOf = (wf: typeof booking, name: string) =>
  wf.nodes.find((n: { name: string }) => n.name === name).parameters.jsCode as string;

describe('Alex booking workflow draft', () => {
  it('both workflows are inactive and every connection points at a real node', () => {
    for (const wf of [booking, alert]) {
      expect(wf.active).toBe(false);
      const names = new Set(wf.nodes.map((n: { name: string }) => n.name));
      for (const [from, v] of Object.entries(
        wf.connections as Record<string, { main: { node: string }[][] }>
      )) {
        expect(names.has(from)).toBe(true);
        for (const branch of v.main) for (const to of branch) expect(names.has(to.node)).toBe(true);
      }
    }
  });

  it('holds no secret, key or real address, and names every credential it needs', () => {
    const text = readdirSync(dir)
      .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/cal_(live|test)_[A-Za-z0-9]+/);
    expect(text).not.toMatch(/xi-api-key|sk-[A-Za-z0-9]{20,}|whsec_/);
    expect(text).not.toMatch(/[\w.+-]+@(?!example)[\w-]+\.(com|net|org)/);
    const creds = new Set<string>();
    for (const wf of [booking, alert])
      for (const n of wf.nodes)
        for (const c of Object.values((n.credentials ?? {}) as Record<string, { name: string }>))
          creds.add(c.name);
    const readme = readFileSync(`${dir}/README.md`, 'utf8');
    for (const name of creds) expect(readme, name).toContain(name);
  });

  it('the portal calls use the documented endpoints and the calcom: id format', () => {
    const urls = booking.nodes
      .map((n: { parameters: { url?: string } }) => n.parameters.url ?? '')
      .join(' ');
    expect(urls).toContain('/api/appointments/book');
    expect(urls).toContain('/api/service/call-results');
    const rec = booking.nodes.find((n: { name: string }) => n.name === 'Record booking in portal');
    expect(rec.parameters.jsonBody).toContain("'calcom:'");
  });

  it('the post-call branch rejects a bad or missing signature and accepts a good one', () => {
    const body = JSON.stringify({ data: { conversation_id: 'conv_1' } });
    const secret = 'draft-secret';
    const run = (
      headers: Record<string, string>,
      raw = body,
      env: Record<string, string> = { ELEVENLABS_POST_CALL_SECRET: secret }
    ) =>
      runInNewContext(`(function () { ${codeOf(booking, 'Verify signature')} })()`, {
        require: (m: string) =>
          m === 'crypto'
            ? require('node:crypto')
            : (() => {
                throw new Error(m);
              })(),
        Buffer,
        Date,
        Math,
        Number,
        Object,
        String,
        JSON,
        $env: env,
        $input: {
          first: () => ({
            json: { headers },
            binary: { data: { data: Buffer.from(raw).toString('base64') } }
          })
        }
      });
    const t = Math.floor(Date.now() / 1000);
    const sign = (s: string, at: number) =>
      `t=${at},v0=${createHmac('sha256', s).update(`${at}.${body}`).digest('hex')}`;
    expect(run({ 'elevenlabs-signature': sign(secret, t) })[0].json.verified).toBe(true);
    expect(run({})[0].json.verified).toBe(false);
    expect(run({ 'elevenlabs-signature': 'nope' })[0].json.verified).toBe(false);
    expect(run({ 'elevenlabs-signature': sign('other', t) })[0].json.verified).toBe(false);
    expect(run({ 'elevenlabs-signature': sign(secret, t - 3600) })[0].json.verified).toBe(false);
    expect(run({ 'elevenlabs-signature': sign(secret, t) }, body + ' ')[0].json.verified).toBe(
      false
    );
    expect(run({ 'elevenlabs-signature': sign(secret, t) }, body, {})[0].json.verified).toBe(false);
  });

  it('maps a post-call payload to the portal body with a stable event id and a closed outcome', () => {
    const payload = {
      event_timestamp: 1_793_000_000,
      data: {
        conversation_id: 'conv_abc',
        agent_id: 'agent_demo',
        metadata: { start_time_unix_secs: 1_793_000_000, call_duration_secs: 94.6 },
        analysis: {
          transcript_summary: 'Booked.',
          data_collection_results: { outcome: { value: 'Booked' } }
        },
        conversation_initiation_client_data: { dynamic_variables: { contact_id: randomUUID() } }
      }
    };
    const run = (p: unknown) =>
      runInNewContext(`(function () { ${codeOf(booking, 'Map call result')} })()`, {
        require: () => require('node:crypto'),
        Date,
        Math,
        String,
        $input: { first: () => ({ json: { body: p } }) }
      });
    const a = run(payload)[0].json;
    const b = run(payload)[0].json;
    expect(a.request.eventId).toBe(b.request.eventId);
    expect(a.request.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(a.request.payload).toMatchObject({
      outcome: 'booked',
      durationS: 95,
      provider: 'elevenlabs'
    });
    const odd = structuredClone(payload);
    odd.data.analysis.data_collection_results.outcome.value = 'something new';
    expect(run(odd)[0].json.request.payload.outcome).toBe('other');
    const noContact = structuredClone(payload);
    delete (noContact.data as Record<string, unknown>).conversation_initiation_client_data;
    expect(run(noContact)[0].json.skip).toBe(true);
  });
});
