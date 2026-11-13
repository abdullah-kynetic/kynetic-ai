// Decrypts a downloaded portal backup (`*.dump.enc`) into a plain pg_dump file for the restore runbook
// (docs/runbooks/restore.md). Usage: BACKUP_ENCRYPTION_KEY=... bun scripts/decrypt-backup.ts <in> <out>
// The key is read from the environment only and is never printed. A wrong key or a damaged file fails
// authentication and writes nothing.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { decryptBackup } from '../src/server/admin/backups';

const [input, output] = process.argv.slice(2);
const key = process.env.BACKUP_ENCRYPTION_KEY;
if (!input || !output || !key) {
  console.error('usage: BACKUP_ENCRYPTION_KEY=... bun scripts/decrypt-backup.ts <in.dump.enc> <out.dump>');
  process.exit(2);
}
if (existsSync(output)) {
  console.error(`refusing to overwrite ${output}`);
  process.exit(2);
}
try {
  const plain = decryptBackup(await readFile(input), key);
  await writeFile(output, plain, { mode: 0o600 });
  console.log(`wrote ${output} (${plain.byteLength} bytes)`);
} catch (error) {
  console.error(`decrypt failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
}
