# kynetic-ai

## Platform

- [`platform/crm`](platform/crm) — Kynetic CRM. Leads, pipeline, and analytics. Live on Vercel, Postgres via Neon.

## Automations

- [`automations/lead-scrape`](automations/lead-scrape) — Kynetic Lead Scrape (n8n + Modal + Notion). Sources leads from Google Maps across the target niches, dedupes, classifies Franchise/Independent, writes to the Outreach DB. See that folder's README for architecture and fix log.

## Voice agents & operations

- [`retell/builds`](retell/builds) — Retell agent builds and snapshots. Active: [Emily Restoration Speed to Lead](retell/builds/emily-speed-to-lead/HANDOFF.md).
- [`tools/retell.py`](tools/retell.py) — Retell API tool (no Deno), dry-run by default.
- [`KYNETIC_CONTEXT.md`](KYNETIC_CONTEXT.md) — rules, IDs and business state for Claude sessions.
- [`Claude Skills`](Claude%20Skills) — skill library; Kynetic skills also in `.claude/skills/`.

Secrets never go in the repo: copy `.env.example` to `.env` locally, or set them as environment variables in Claude Code cloud.
