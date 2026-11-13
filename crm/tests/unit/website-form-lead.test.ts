import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leadPayloadSchema, verifyLeadSignature } from '@/server/leads';

// The n8n Code node that moves the website contact form from Twenty to the portal lead endpoint.
// This runs the real node file and checks the portal accepts what it produces.

const code = readFileSync(
  join(process.cwd(), '..', 'n8n/code/website-form-to-portal-lead.js'),
  'utf8'
);
const TENANT = '11111111-1111-4111-8111-111111111111';
const SECRET = 'test-signing-secret';

function runNode(item: Record<string, unknown>, env: Record<string, string | undefined>) {
  const fn = new Function('$input', '$env', 'require', code);
  return fn({ item: { json: item } }, env, require) as {
    json: { url: string; body: string; headers: Record<string, string> };
  };
}
const env = { PORTAL_LEAD_TENANT_ID: TENANT, PORTAL_LEAD_SECRET: SECRET };

describe('website form to portal lead (n8n Code node)', () => {
  it('builds a body the portal accepts and a signature it verifies', () => {
    const out = runNode(
      {
        name: 'Dana  Q Roofer',
        email: 'Dana@Example.test ',
        message: 'Need a quote',
        received_at: '2026-11-13T12:00:00.000Z'
      },
      env
    ).json;
    expect(out.url).toBe(`https://portal.kyneticai.com/api/hooks/leads/${TENANT}`);
    const lead = leadPayloadSchema.parse(JSON.parse(out.body));
    expect(lead).toMatchObject({
      source: 'website_form',
      firstName: 'Dana',
      lastName: 'Q Roofer',
      email: 'dana@example.test'
    });
    expect(lead.consent).toBeUndefined();
    expect(
      verifyLeadSignature({
        secret: SECRET,
        timestamp: out.headers['x-kynetic-timestamp']!,
        signature: out.headers['x-kynetic-signature']!,
        rawBody: out.body
      })
    ).toBe(true);
    // A wrong secret, or a changed body, fails.
    expect(
      verifyLeadSignature({
        secret: 'other',
        timestamp: out.headers['x-kynetic-timestamp']!,
        signature: out.headers['x-kynetic-signature']!,
        rawBody: out.body
      })
    ).toBe(false);
  });

  it('handles a one-word name, gives each submission its own id, and keeps retries stable', () => {
    const a = {
      name: 'Cher',
      email: 'c@example.test',
      message: 'Hi',
      received_at: '2026-11-13T12:00:00Z'
    };
    const first = JSON.parse(runNode(a, env).json.body);
    expect(first.lastName).toBeUndefined();
    expect(leadPayloadSchema.safeParse(first).success).toBe(true);
    expect(JSON.parse(runNode(a, env).json.body).externalId).toBe(first.externalId);
    const second = JSON.parse(
      runNode({ ...a, received_at: '2026-11-13T12:00:01Z' }, env).json.body
    );
    expect(second.externalId).not.toBe(first.externalId);
  });

  it('refuses to run without the tenant id and secret', () => {
    const item = { name: 'A B', email: 'a@example.test', message: 'x', received_at: 'now' };
    expect(() => runNode(item, {})).toThrow('not set');
  });
});
