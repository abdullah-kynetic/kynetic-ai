// Entry point: `KYNETIC_MCP_TOKENS='{"slug":"token"}' bun mcp/stdio.ts`. Speaks MCP over stdin and stdout.
// Logs go to stderr only, so nothing but protocol messages reaches stdout.

import { createInterface } from 'node:readline';
import { configFromEnv, serveLines } from './server';

const cfg = configFromEnv(process.env);
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
await serveLines(cfg, lines, (line) => {
  process.stdout.write(`${line}\n`);
});
