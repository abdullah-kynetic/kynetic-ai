// Local demo only: no sign-in. Starts the synthetic e2e server (throwaway database, fake data, outbound
// off) and a small proxy that attaches a ready-made session cookie to every request, so the browser
// opens straight into the app. Nothing in src/ is changed, so there is no way to leave a bypass behind
// in a real deploy. Needs a local Postgres 16 (TEST_DATABASE_ADMIN_URL) and a built app (`bun run build`).
//
//   http://localhost:3000/            admin (default)
//   http://localhost:3000/as/admin    switch to the Kynetic admin
//   http://localhost:3000/as/va       switch to the Kynetic VA
//   http://localhost:3000/as/owner    switch to a client owner (Tenant A)
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';

const port = Number(process.env.DEMO_PORT ?? 3000);
const innerPort = Number(process.env.E2E_PORT ?? 3100);
const inner = `http://localhost:${innerPort}`;
const outer = `http://localhost:${port}`;
const files = {
  admin: '/tmp/kynetic-crm-e2e-admin.json',
  va: '/tmp/kynetic-crm-e2e-va.json',
  owner: '/tmp/kynetic-crm-e2e-owner.json'
} as const;
type Who = keyof typeof files;

if (!process.env.TEST_DATABASE_ADMIN_URL) {
  console.error('Set TEST_DATABASE_ADMIN_URL to a LOCAL Postgres 16 superuser URL first.');
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(process.env.TEST_DATABASE_ADMIN_URL)) {
  console.error('Refusing to run: TEST_DATABASE_ADMIN_URL must point at this computer.');
  process.exit(1);
}

const server = spawn('bun', ['tests/e2e/server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, E2E_PORT: String(innerPort) },
  stdio: 'inherit'
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1500);
  });
}
server.once('exit', (code) => process.exit(code ?? 0));

async function ready(): Promise<void> {
  for (;;) {
    try {
      if ((await fetch(`${inner}/api/health`)).ok) return;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function cookieFor(who: Who): Promise<string> {
  const json = JSON.parse(await readFile(files[who], 'utf8')) as {
    cookies: { name: string; value: string }[];
  };
  const c = json.cookies[0]!;
  return `${c.name}=${encodeURIComponent(c.value)}`;
}

await ready();
let who: Who = 'admin';

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? '/', outer);
    const switchTo = /^\/as\/(admin|va|owner)$/.exec(url.pathname);
    if (switchTo) {
      who = switchTo[1] as Who;
      outgoing.writeHead(302, { location: `${outer}${who === 'owner' ? '/dashboard' : '/admin'}` });
      outgoing.end();
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(incoming.headers)) {
      if (v === undefined || k === 'accept-encoding') continue;
      headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    }
    headers.set('host', `localhost:${innerPort}`);
    headers.set('cookie', await cookieFor(who));
    for (const h of ['origin', 'referer']) {
      const v = headers.get(h);
      if (v) headers.set(h, v.replace(outer, inner));
    }
    const hasBody = incoming.method !== 'GET' && incoming.method !== 'HEAD';
    const res = await fetch(`${inner}${url.pathname}${url.search}`, {
      method: incoming.method,
      headers,
      body: hasBody ? (Readable.toWeb(incoming) as unknown as BodyInit) : undefined,
      redirect: 'manual',
      // Node's fetch needs this to stream a request body.
      ...(hasBody ? { duplex: 'half' } : {})
    } as RequestInit);
    const out: Record<string, string | string[]> = {};
    res.headers.forEach((v, k) => {
      if (k === 'content-encoding' || k === 'content-length' || k === 'set-cookie') return;
      out[k] = k === 'location' ? v.replace(inner, outer) : v;
    });
    const cookies = res.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    outgoing.writeHead(res.status, out);
    if (res.body) Readable.fromWeb(res.body as never).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    outgoing.writeHead(502);
    outgoing.end(String(error));
  }
}).listen(port, '127.0.0.1');

process.stdout.write(`\nDemo ready: ${outer}  (signed in as the Kynetic admin, fake data only)\n`);
process.stdout.write(`Switch user: ${outer}/as/admin | ${outer}/as/va | ${outer}/as/owner\n\n`);
