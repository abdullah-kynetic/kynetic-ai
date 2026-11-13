import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encryptBackup } from '@/server/admin/backups';

const KEY = 'ab'.repeat(32);
const dir = mkdtempSync(join(tmpdir(), 'decrypt-backup-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[], key: string | undefined) {
  const env = { ...process.env };
  delete env.BACKUP_ENCRYPTION_KEY;
  if (key) env.BACKUP_ENCRYPTION_KEY = key;
  return spawnSync('bun', ['scripts/decrypt-backup.ts', ...args], { env, encoding: 'utf8' });
}

describe('scripts/decrypt-backup.ts', () => {
  const plain = Buffer.from('PGDMP-fake-dump-bytes');
  const enc = join(dir, 'a.dump.enc');
  writeFileSync(enc, encryptBackup(plain, KEY));

  it('writes the plain dump and never prints the key', () => {
    const out = join(dir, 'a.dump');
    const r = run([enc, out], KEY);
    expect(r.status).toBe(0);
    expect(readFileSync(out).equals(plain)).toBe(true);
    expect(r.stdout + r.stderr).not.toContain(KEY);
  });

  it('refuses a wrong key and writes nothing', () => {
    const out = join(dir, 'b.dump');
    const r = run([enc, out], 'cd'.repeat(32));
    expect(r.status).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  it('refuses to overwrite, and needs the key and both paths', () => {
    const out = join(dir, 'c.dump');
    writeFileSync(out, 'keep');
    expect(run([enc, out], KEY).status).toBe(2);
    expect(readFileSync(out, 'utf8')).toBe('keep');
    expect(run([enc], KEY).status).toBe(2);
    expect(run([enc, join(dir, 'd.dump')], undefined).status).toBe(2);
  });
});
