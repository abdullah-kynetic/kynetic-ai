import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const kinds = ['missed-call', 'reminder', 'owner-alert', 'error-alert'] as const;
const workflows = Object.fromEntries(
  kinds.map((kind) => [kind, JSON.parse(readFileSync(`../n8n/workflows/dev/${kind}.json`, 'utf8'))])
);
const phone = '+' + ['1', '555', '555', '0101'].join('');
const id = '11111111-1111-4111-8111-111111111111';
const recordId = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-11-05T18:00:00Z');
const event = {
  id,
  tenantId: id,
  synthetic: true,
  gate: { allowed: true },
  name: 'call.completed',
  direction: 'inbound',
  outcome: 'no_answer',
  callId: recordId,
  contactId: recordId,
  appointmentId: recordId,
  bookingStatus: 'confirmed'
};
function run(kind: string, input: object, env: object = { TEST_PHONE: phone }) {
  const code = workflows[kind].nodes.find((node: { id: string }) => node.id === 'prepare')
    .parameters.jsCode;
  return runInNewContext(
    `(function(){${code}\n})()`,
    {
      $env: env,
      $workflow: { id: 'own-workflow' },
      $input: { all: () => [{ json: input }] },
      Date: { now: () => now, parse: Date.parse }
    },
    { timeout: 100 }
  );
}
function eligible(kind: string) {
  return {
    ...event,
    name:
      kind === 'reminder'
        ? 'appointment.booked'
        : kind === 'owner-alert'
          ? 'lead.created'
          : kind === 'error-alert'
            ? 'workflow.failed'
            : 'call.completed'
  };
}
describe('inactive DEV notification workflow stubs', () => {
  it.each(kinds)(
    '%s prepares only an inert TEST_PHONE preview and embeds the reviewed source',
    (kind) => {
      const workflow = workflows[kind];
      expect(workflow.active).toBe(false);
      expect(workflow.tags).toContainEqual({ name: 'DEV' });
      const sms = workflow.nodes.find((node: { id: string }) => node.id === 'sms-disabled');
      expect(sms.disabled).toBe(true);
      expect(sms.parameters.to).toBe('={{ $env.TEST_PHONE }}');
      expect(sms.credentials).toBeUndefined();
      expect(sms.retryOnFail).toBe(false);
      expect(workflow.settings.saveDataSuccessExecution).toBe('none');
      expect(workflow.settings.saveDataErrorExecution).toBe('none');
      const source = readFileSync('../n8n/workflows/dev/notification-prepare.js', 'utf8');
      expect(
        workflow.nodes.find((node: { id: string }) => node.id === 'prepare').parameters.jsCode
      ).toBe(`const KIND = '${kind}';\n${source}`);
      const [out] = run(kind, {
        body: { ...eligible(kind), to: 'untrusted-destination', error: 'private-test-token' }
      });
      expect(out.json).toMatchObject({
        status: 'stub_preview',
        dispatch_enabled: false,
        requires_server_recheck: true,
        request: { To: '{{TEST_PHONE}}' }
      });
      expect(JSON.stringify(out)).not.toContain('private-test-token');
      expect(JSON.stringify(out)).not.toContain('untrusted-destination');
      const sinkCode = workflow.nodes.find((node: { id: string }) => node.id === 'stub-result')
        .parameters.jsCode;
      const [result] = runInNewContext(`(function(){${sinkCode}})()`, {
        $input: { all: () => [out] }
      });
      expect(result.json).toMatchObject({ provider_requests: 0, delivered: false });
    }
  );
  it.each(kinds)('%s refuses missing TEST_PHONE and non-synthetic events', (kind) => {
    expect(() => run(kind, eligible(kind), {})).toThrow('TEST_PHONE');
    expect(() => run(kind, { ...eligible(kind), synthetic: false })).toThrow('Synthetic');
    expect(() => run(kind, { ...eligible(kind), id: 'unsafe\nidentity' })).toThrow('UUID');
  });
  it('accepts native portal envelopes without letting payload override the root tenant identity', () => {
    const [out] = run('missed-call', {
      id,
      tenantId: id,
      name: 'call.completed',
      payload: {
        synthetic: true,
        direction: 'inbound',
        outcome: 'no_answer',
        callId: recordId,
        tenantId: recordId,
        gate: { allowed: true }
      }
    });
    expect(out.json).toMatchObject({
      tenantId: id,
      status: 'stub_preview',
      dispatch_enabled: false
    });
  });

  it('does not prepare textback for outbound or answered calls', () => {
    expect(run('missed-call', { ...event, direction: 'outbound' })).toHaveLength(0);
    expect(run('missed-call', { ...event, outcome: 'answered' })).toHaveLength(0);
  });
  it('requires confirmation, skips future/expired reminders, and prepares a currently due reminder', () => {
    const input = {
      ...eligible('reminder'),
      name: 'appointment.reminder_due',
      dueAt: '2026-11-05T17:00:00Z',
      expiresAt: '2026-11-05T19:00:00Z'
    };
    expect(run('reminder', input)[0].json.action).toBe('reminder');
    expect(run('reminder', { ...input, dueAt: '2026-11-05T18:30:00Z' })).toHaveLength(0);
    expect(run('reminder', { ...input, expiresAt: '2026-11-05T18:00:00Z' })).toHaveLength(0);
    expect(run('reminder', { ...input, bookingStatus: 'cancelled' })).toHaveLength(0);
    expect(() => run('reminder', { ...input, dueAt: 'invalid' })).toThrow('times');
  });
  it('blocks missing/denied gate snapshots and defers quiet hours without producing a request', () => {
    for (const gate of [
      undefined,
      { allowed: false, reason: 'no_consent' },
      { allowed: false, reason: 'outbound_disabled' }
    ]) {
      const [out] = run('missed-call', { ...event, gate });
      expect(out.json.status).toBe('blocked');
      expect(out.json.request).toBeUndefined();
    }
    expect(
      run('missed-call', { ...event, gate: { allowed: false, reason: 'quiet_hours' } })[0].json
        .status
    ).toBe('deferred');
  });
  it('deduplicates repeated events by record/action key in the fake sink and separates reminder from confirmation', () => {
    const sink = new Map();
    for (let i = 0; i < 3; i++)
      for (const out of run('reminder', eligible('reminder')))
        sink.set(out.json.idempotencyKey, out.json);
    expect(sink.size).toBe(1);
    const [reminder] = run('reminder', {
      ...eligible('reminder'),
      name: 'appointment.reminder_due',
      dueAt: '2026-11-05T17:00:00Z',
      expiresAt: '2026-11-05T19:00:00Z'
    });
    sink.set(reminder.json.idempotencyKey, reminder.json);
    expect(sink.size).toBe(2);
  });
  it('suppresses recursive error alerts and never includes provider error details', () => {
    expect(
      run('error-alert', { ...eligible('error-alert'), originWorkflowId: 'own-workflow' })
    ).toHaveLength(0);
    const result = run('error-alert', {
      ...eligible('error-alert'),
      error: {
        message: 'private-token',
        stack: 'private-stack',
        url: 'https://example.test/?token=private-token'
      }
    });
    expect(JSON.stringify(result)).not.toContain('private-');
  });
});
