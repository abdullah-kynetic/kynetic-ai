import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// P5-5. A model never decides consent, quiet hours, DNC or whether a call is allowed. Those stay in
// code. The strongest way to keep that true is structural: nothing under src/server/llm and nothing in
// the model adapter may import or name the modules and tables that hold that state. A model answer is
// text; the only thing that reads it is a feature that writes its own tables.
const ROOTS = ['src/server/llm', 'src/server/adapters/llm'];

const FORBIDDEN_IMPORTS = [
  /server\/consent/,
  /server\/compliance/,
  /server\/contact-policy/,
  /server\/contact-decisions/,
  /server\/outbound/,
  /server\/messaging/,
  /server\/calls\/outbound/,
  /server\/agency\/(dialer|messaging|campaign)/,
  /from ['"]\.\.?\/(\.\.\/)*(consent|compliance|outbound|messaging|contact-policy|contact-decisions)/
];
const FORBIDDEN_NAMES =
  /\b(consentRecords|dncEntries|contactDecisions|canContact|checkOutbound|recordConsent|recordOptOut|quietHours|QuietWindow|sendContactMessage|startOutboundCall)\b|consent_records|dnc_entries|contact_decisions|business_hours/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

export function violations(path: string, source: string): string[] {
  const out: string[] = [];
  for (const line of source.split('\n')) {
    if (/^\s*(import|export)\b.*from\b/.test(line) || /\bimport\(/.test(line)) {
      if (FORBIDDEN_IMPORTS.some((re) => re.test(line)))
        out.push(`${path}: imports ${line.trim()}`);
    }
    const code = line.replace(/\/\/.*$/, '');
    if (FORBIDDEN_NAMES.test(code)) out.push(`${path}: names ${line.trim()}`);
  }
  return out;
}

describe('P5-5 the model layer cannot reach compliance state', () => {
  it('no file under the model layer imports or names consent, DNC, quiet hours or call dispatch', () => {
    const all = ROOTS.flatMap((r) => files(r));
    expect(all.length).toBeGreaterThan(3);
    const found = all.flatMap((f) => violations(f, readFileSync(f, 'utf8')));
    expect(found).toEqual([]);
  });

  it('the scan itself fails on code that tries (so a green run means something)', () => {
    const attempts = [
      "import { canContact } from '@/server/consent';",
      "import { recordOptOut } from '../consent/record';",
      "const { dncEntries } = await import('@/server/db/schema');",
      "await tx.execute(sql`update consent_records set kind = 'express_written'`);",
      "import { checkOutbound } from '@/server/outbound';",
      'tenant.business_hours = model.hours;'
    ];
    for (const code of attempts) expect(violations('x.ts', code).length).toBeGreaterThan(0);
    expect(violations('x.ts', "import { sql } from 'drizzle-orm';")).toEqual([]);
  });
});
