import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const workflow = JSON.parse(
  readFileSync('../n8n/workflows/dev/elevenlabs-speed-to-lead.json', 'utf8')
);
const code = workflow.nodes.find((n: { type: string }) => n.type === 'n8n-nodes-base.code')
  .parameters.jsCode;
const testPhone = '+' + ['1', '555', '555', '0101'].join('');
function run(lead: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return runInNewContext(`(function () { ${code} })()`, {
    $env: {
      TEST_PHONE: testPhone,
      DEV_ELEVENLABS_AGENT_ID: 'synthetic-agent',
      DEV_ELEVENLABS_PHONE_NUMBER_ID: 'synthetic-phone',
      ...over
    },
    $input: { all: () => [{ json: lead }] }
  });
}
describe('DEV ElevenLabs synthetic workflow', () => {
  it('preserves project_type and budget, permits missing email and ignores supplied phone', () => {
    const [out] = run({
      body: {
        synthetic: true,
        phone: 'untrusted-destination',
        project_type: 'roof',
        budget: 'test budget'
      }
    });
    expect(out.json.request.to_number).toBe(testPhone);
    expect(out.json.request.conversation_initiation_client_data.dynamic_variables).toMatchObject({
      project_type: 'roof',
      budget: 'test budget',
      email: ''
    });
    expect(out.json.dispatch_enabled).toBe(false);
  });
  it('fails closed without TEST_PHONE or with non-synthetic input', () => {
    expect(() => run({ synthetic: true }, { TEST_PHONE: undefined })).toThrow('TEST_PHONE');
    expect(() => run({ synthetic: false })).toThrow('Synthetic');
    expect(() => run({ synthetic: true }, { DEV_ELEVENLABS_AGENT_ID: '' })).toThrow('identifiers');
  });
  it.each(['FL', 'OK', ' fl ', 'ok'])('rejects unsupported state %s', (business_state) => {
    expect(() => run({ synthetic: true, business_state })).toThrow('not supported');
  });
  it('keeps the workflow inactive, DEV tagged and its outbound node disabled', () => {
    expect(workflow.active).toBe(false);
    expect(workflow.tags).toContainEqual({ name: 'DEV' });
    const dispatch = workflow.nodes.find(
      (n: { type: string }) => n.type === 'n8n-nodes-base.httpRequest'
    );
    expect(dispatch.disabled).toBe(true);
    expect(dispatch.retryOnFail).toBe(false);
  });
});
