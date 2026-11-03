import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const code = readFileSync(
  new URL('../../../n8n/drafts/m15-error-alert.js', import.meta.url),
  'utf8'
);
type Alert = {
  idempotencyKey: string;
  subject: string;
  text: string;
  workflowId: string;
  executionId: string;
};
const format = (input: unknown, ownId = 'error-alert-workflow'): { json: Alert }[] =>
  runInNewContext(
    `(function () { ${code}\n })()`,
    { $input: { first: () => ({ json: input }) }, $workflow: { id: ownId } },
    { timeout: 100 }
  );
describe('M15-04 F-89 error alert draft', () => {
  it('runs the actual Code body and sends one fake email for repeated delivery of a failed execution', async () => {
    const sent: Alert[] = [];
    const keys = new Set<string>();
    const fakeDelivery = async (alert: Alert) => {
      if (keys.has(alert.idempotencyKey)) return;
      keys.add(alert.idempotencyKey);
      sent.push(alert);
    };
    const failure = {
      workflow: { id: 'synthetic-workflow' },
      execution: { id: 42, error: { message: 'synthetic-provider-failure' } }
    };
    for (let attempt = 0; attempt < 3; attempt++)
      for (const item of format(failure)) await fakeDelivery(item.json);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.idempotencyKey).toBe('n8n-error:synthetic-workflow:42');
    expect(sent[0]!.text).toContain('execution 42 failed');
  });
  it('excludes arbitrary errors, names, URLs, stacks and customer data', () => {
    const result = format({
      workflow: { id: 'flow-1', name: 'synthetic-private-name' },
      execution: {
        id: 'run-1',
        url: 'https://example.test/?token=synthetic-private-token',
        error: { message: 'synthetic-private-error', stack: 'synthetic-private-stack' }
      },
      body: { phone: 'synthetic-private-phone' }
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });
  it('rejects missing or unsafe identities and suppresses recursive self-alerts', () => {
    for (const input of [
      null,
      {},
      { workflow: { id: 'flow' }, execution: {} },
      { workflow: { id: 'flow\nmalformed' }, execution: { id: 'run' } }
    ]) {
      expect(() => format(input)).toThrow(/stable workflow and execution IDs/);
    }
    expect(
      format({ workflow: { id: 'error-alert-workflow' }, execution: { id: 'run' } })
    ).toHaveLength(0);
  });
});
