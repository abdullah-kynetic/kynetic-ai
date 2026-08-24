# Kynetic fork notes

Vendored copy of [seldonframe/seldonframe](https://github.com/seldonframe/seldonframe),
brought in as a subfolder of `kynetic-ai` rather than a separate GitHub repo (this
session's GitHub App couldn't create new repos — 403 on `POST /user/repos` — so this is
the workaround). Git history from upstream was not carried over; this is a snapshot as
of the date it was copied in, not a real `git fork`.

## Why it's here
Serving as the base for Kynetic's client-delivery platform (website + booking + CRM +
AI voice/chat receptionist per client) — see the plan discussed with Abdullah. The goal
is to run this **headless**: keep the full codebase, but only surface the CRM +
booking-sync + event/automation layer. n8n, Modal, Apify, and Retell/Twilio/Cal.com stay
exactly as they are in `automations/` — this is not replacing them, it's replacing
Notion as the long-term system of record.

## License
AGPL-3.0, dual-licensed by the upstream project. Self-hosting for Kynetic's own business
and clients is free under AGPL as long as modifications are shared if run as a network
service. Reselling this white-labeled to clients with proprietary changes requires their
commercial/Agency tier — see `LICENSING.md` in this folder before that happens.

## Status
Just vendored — nothing configured, no feature flags added yet, not deployed, not
connected to any of Kynetic's data. Next steps: pnpm install, stand up Postgres (Neon),
scope down what's exposed via feature flags, wire the Modal → Postgres write path.
