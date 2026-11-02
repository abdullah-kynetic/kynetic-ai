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

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    const switchTo = /^\/as\/(admin|va|owner)$/.exec(url.pathname);
    if (switchTo) {
      who = switchTo[1] as Who;
      return Response.redirect(`${outer}${who === 'owner' ? '/dashboard' : '/admin'}`, 302);
    }
    const headers = new Headers(req.headers);
    headers.set('host', `localhost:${innerPort}`);
    headers.set('cookie', await cookieFor(who));
    headers.delete('accept-encoding');
    for (const h of ['origin', 'referer']) {
      const v = headers.get(h);
      if (v) headers.set(h, v.replace(outer, inner));
    }
    const res = await fetch(`${inner}${url.pathname}${url.search}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: 'manual'
    });
    const out = new Headers(res.headers);
    const location = out.get('location');
    if (location) out.set('location', location.replace(inner, outer));
    out.delete('content-encoding');
    out.delete('content-length');
    return new Response(res.body, { status: res.status, headers: out });
  }
});

console.log(`\nDemo ready: ${outer}  (signed in as the Kynetic admin, fake data only)`);
console.log(`Switch user: ${outer}/as/admin | ${outer}/as/va | ${outer}/as/owner\n`);
