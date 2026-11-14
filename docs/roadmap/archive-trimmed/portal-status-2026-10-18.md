# [ARCHIVED 2026-11-09, superseded by SCORECARD 5c44b12e] Portal status: 2026-10-18

_Twenty note `9b9ff979`, created 2026-10-18, updated 2026-11-09. Exported 2026-11-12._

**Live (deployed with `portal-deploy`).** PR #20 (`533103a`) sign-in hardening, #24 (`7cd69cc`) two-step admin login + Remember this device for 30 days (admin only; skips only the authenticator code), #25 (`bdc4afe`) new invites sign the user straight in (resets still end at the sign-in page; a new admin must set up an authenticator first). Docs: #21, #22 (D-022), #23, #26. All merged as merge commits.

**Google sign-in is ON** for invited clients only. Admins stay on password + authenticator by design.

**Decided 2026-10-18.** `bob-box-ovh-vps` keeps full root (KI-010 closed). `portal-deploy` is the single deploy path (D-022). "Outbound Speed to Lead" (`m2YJwZ1l8DTzyEkw`) stays live (KI-009 closed; no n8n change was made).

**VPS cleanup (approved).** Bookstack and Docmost trials removed, plus the 6.6 GB build cache. Disk 9.8 GB of 72 GB used (14%); about 4.7 GB memory available; portal, portal DB and Twenty healthy. Unused images left: postgres:18, redis:8, hello-world.

**New: self-host n8n on the VPS (planning only).** Abdullah wants to start self-hosting n8n to avoid cloud execution limits and cost. Not started; no n8n change approved. Estimate: about 1.5-2 GB disk at first (execution history is what grows; prune it), about 0.3-1 GB memory. Plan must cover off-server backups, the lead-form and Retell post-call webhook URLs, credentials, HTTPS, rollback. Step 1 is a read-only export and size check of the cloud workflows.

**Still open.** KI-006 gaps (DB passwords in the container environment; no off-server backups or restore test; client A/B isolation test). KI-005 (post-call webhook has no header auth). Abdullah's to-do: generate admin recovery codes; test invite, forgot-password, Users-tab buttons and Google with `abdullah.ahmed5454@gmail.com` (Test Client A) and `abduthelegend1@gmail.com` (Test Client B).
