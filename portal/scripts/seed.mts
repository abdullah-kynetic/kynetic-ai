/**
 * Seeds ONLY fake data: "Test Client A" and "Test Client B" with profiles, contacts, scope, timeline,
 * documents and 30 days of fake results, plus one client user each. Idempotent (skips if A exists).
 * Runs as the owner role inside an admin-scoped transaction (RLS is FORCEd, so scope is required).
 *
 * Env: DATABASE_OWNER_URL, UPLOAD_DIR (local storage), SEED_PASSWORD_FILE (optional: where to write
 * the generated test-user passwords, chmod 600; otherwise SEED_CLIENT_PASSWORD is used).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { hash } from "@node-rs/argon2";

const sql = postgres(process.env.DATABASE_OWNER_URL!, { max: 1, onnotice: () => {} });
const uploadDir = process.env.UPLOAD_DIR ?? "./.data/uploads";
const argon = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

function rand(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

const TEST_CLIENTS = [
  { key: "A", name: "Test Client A", industry: "Roofing", city: "Austin, TX", email: "client-a@example.com", seed: 7 },
  { key: "B", name: "Test Client B", industry: "HVAC", city: "Denver, CO", email: "client-b@example.com", seed: 13 },
];

async function main() {
  const passwords: Record<string, string> = {};
  await sql.begin(async (tx) => {
    await tx`select set_config('app.role', 'admin', true)`;
    const [exists] = await tx`select id from clients where name = 'Test Client A'`;
    if (exists) { console.log("[seed] already seeded — skipping"); return; }
    for (const c of TEST_CLIENTS) {
      const [{ id }] = await tx`insert into clients (name, slug, status, plan_name, included_minutes)
        values (${c.name}, ${"test-client-" + c.key.toLowerCase()}, 'active', 'Plan 1', 1200) returning id`;
      await tx`insert into business_profiles (client_id, legal_name, industry, website, phone, address, service_area, hours, notes)
        values (${id}, ${c.name + " LLC"}, ${c.industry}, ${"https://example.com/" + c.key.toLowerCase()}, '+1 555 010 0' || ${c.key === "A" ? "100" : "200"},
          ${"123 Example St, " + c.city}, ${c.city + " metro"}, 'Mon–Fri 8am–6pm', 'Fake seed data for testing.')`;
      await tx`insert into contacts (client_id, name, title, email, phone, is_primary) values
        (${id}, ${"Owner " + c.key}, 'Owner', ${"owner-" + c.key.toLowerCase() + "@example.com"}, '+1 555 0100', true),
        (${id}, ${"Office Manager " + c.key}, 'Office Manager', ${"office-" + c.key.toLowerCase() + "@example.com"}, '+1 555 0101', false)`;
      const scope = [
        ["Speed-to-lead voice agent", "AI agent calls every new web lead within 60 seconds.", "done"],
        ["Missed-call text-back", "Instant SMS when a call is missed.", "in_progress"],
        ["Calendar booking", "Agent books inspections directly into the calendar.", "in_progress"],
        ["Weekly results report", "Automated summary of leads, calls and bookings.", "planned"],
      ];
      for (const [i, [title, description, status]] of scope.entries()) {
        await tx`insert into scope_items (client_id, title, description, status, sort) values (${id}, ${title}, ${description}, ${status}, ${i})`;
      }
      const today = new Date();
      const d = (offset: number) => new Date(today.getTime() + offset * 86400_000).toISOString().slice(0, 10);
      const ms = [
        ["kickoff", "Kickoff call", "Goals, numbers and access.", d(-28), "done"],
        ["build", "Build agents & automations", "Voice agent, SMS and CRM wiring.", d(-14), "done"],
        ["testing", "Testing & QA", "Test calls and edge cases.", d(-3), "in_progress"],
        ["go_live", "Go-live", "Switch on for all inbound leads.", d(5), "upcoming"],
      ];
      for (const [i, [phase, title, description, due, status]] of ms.entries()) {
        await tx`insert into milestones (client_id, phase, title, description, due_date, status, completed_at, sort)
          values (${id}, ${phase}, ${title}, ${description}, ${due}, ${status}, ${status === "done" ? new Date() : null}, ${i})`;
      }
      // Documents (small text files written to local storage).
      for (const [name, category, body] of [
        ["Plan 1 Scope.txt", "Contracts", `Plan 1 scope for ${c.name} (fake).`],
        ["Kickoff Notes.txt", "Meeting notes", `Kickoff notes for ${c.name} (fake).`],
      ]) {
        const key = `${id}/${randomUUID()}`;
        const file = path.join(path.resolve(uploadDir), key);
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writeFile(file, body, { mode: 0o600 });
        await tx`insert into documents (client_id, name, category, storage_key, mime, size, uploaded_by_role)
          values (${id}, ${name}, ${category}, ${key}, 'text/plain', ${Buffer.byteLength(body)}, 'admin')`;
      }
      // 30 days of fake results.
      const r = rand(c.seed);
      for (let i = 29; i >= 0; i--) {
        const leads = 3 + Math.floor(r() * 10);
        const calls = leads + Math.floor(r() * 6);
        const bookings = Math.floor(leads * (0.2 + r() * 0.3));
        const minutes = Math.round(calls * (2 + r() * 3) * 10) / 10;
        const speed = Math.round((12 + r() * 40) * 10) / 10;
        await tx`insert into daily_results (client_id, date, leads, calls, bookings, minutes_used, avg_speed_to_lead_sec)
          values (${id}, ${d(-i)}, ${leads}, ${calls}, ${bookings}, ${minutes}, ${speed})`;
      }
      const pw = process.env.SEED_CLIENT_PASSWORD || randomBytes(12).toString("base64url");
      passwords[c.email] = pw;
      await tx`insert into users (email, name, role, client_id, password_hash) values (${c.email}, ${"Test User " + c.key}, 'client', ${id}, ${await hash(pw, argon)})`;
      console.log(`[seed] ${c.name} created`);
    }
  });
  if (Object.keys(passwords).length && process.env.SEED_PASSWORD_FILE) {
    await writeFile(process.env.SEED_PASSWORD_FILE, Object.entries(passwords).map(([e, p]) => `${e} ${p}`).join("\n") + "\n", { mode: 0o600 });
    console.log(`[seed] test-user passwords written to ${process.env.SEED_PASSWORD_FILE}`);
  }
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
