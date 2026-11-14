# Tech Stack & Build Standards

_Twenty note `9a8985b7`, created 2026-09-24, updated 2026-10-14. Exported 2026-11-12._

**CURRENT STACK (Oct 13, 2026):** Twenty = CRM and system of record (D-006). n8n Cloud = automations. Retell = voice platform (D-018; workspaces abdullahblitz for new builds incl. Alex, kyneticai for Nora/Emily). Cal.com = booking. Stripe = milestone invoices (D-017). Notion = legacy reference only. Vapi parked. SeldonFrame/Kynetic OS dropped Sep 24. Supabase and Modal: not in use (not confirmed if still planned). Older text below may disagree; this banner wins.

---

The stack Kynetic AI builds on, and the rule for how complex a system is allowed to get before it needs re-architecting.

**Core stack:** n8n Cloud Pro (automation backbone, every workflow's trigger/final action lives here). Notion (primary data store for now, being replaced by Twenty). Supabase (Postgres backend for when a client needs true relational data or a live dashboard, not used until Notion/Twenty's limits actually bite). Retell AI (all inbound/outbound voice agents, native Cal.com booking, does its own reasoning, never wrapped in Modal). Modal (serverless Python for heavy/agentic logic, called from n8n via HTTP Request, only when a workflow clears the Agentic Eligibility Checklist bar, an escape hatch not a default). Supabase + lightweight front end or embedded view for client-facing reporting dashboards (upsell line).

**No GoHighLevel** - everything is custom-built so it stays fully owned and inspectable, not dependent on one vendor.

**Why n8n stays the backbone even with Modal involved:** Modal only ever replaces the middle of a flow. Pattern: Trigger (n8n) -> HTTP Request to Modal endpoint -> Action (n8n). A 15-20 node workflow doing lookups/retrieval/multi-step reasoning collapses to 3-5 nodes.

**Phase 1 build stack per system:** System 3 Database Reactivation - n8n + Twilio + Gmail API + Claude API, n8n-native, 6-touch SMS-first sequence. System 1 Reputation Engine - GBP API + n8n + BrightLocal + Claude API, n8n-native. System 3 Lead Nurture - n8n + Twilio + Gmail API + Claude API. System 2 AI Receptionist voice - Retell AI + Cal.com + n8n, Retell owns its own reasoning. System 2 AI Receptionist text channels - n8n + Notion (now Twenty), AI Agent node, no Retell/voice cost. Demo Site Generator - Claude Code + Netlify, manual/code not n8n. Auto-Quote/Estimate Agent - n8n + Modal (candidate) + Claude API, the one clear Modal-hybrid candidate.

**Explicitly out of scope for Phase 1:** AI Sales Coach, Paid Ads, Client Results Dashboard. Don't start until client 1 is live.

**Account/credential checklist:** n8n Cloud Pro plan tier, Retell AI account + Cal.com integration tested end to end, Modal account + starter credit + API token, Claude Code configured, Supabase project (not needed yet), Twenty integration scoped for n8n writes (replacing Notion token), Apify token, Twilio number(s), Gmail API auth.
