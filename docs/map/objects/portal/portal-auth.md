---
type: object
cluster: portal
universe: live
status: verified
entity: portal/src/lib/auth/
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# Portal sign-in

Invite-only. Google sign-in only admits an existing account with a verified matching email (`google.ts` decision function; reasons: unverified, not_invited, disabled, admin_requires_mfa). `requireClient()` and `requireAdmin()` in `session.ts:47,54` gate pages; static tests check they are called.

## Shape
- Modules: password (Argon2id), pwned screen, totp, recovery codes, tokens, device trust, session.
- Admins need password + authenticator (D-021); Google is clients only.

## If you change this
- **Hits:** `portal/tests/*` (auth, google-gate, recovery, trusted-device), D-021, `portal/ADMIN.md`, email templates, [[portal-tenancy-rls]].
- Not verified here: live Google OAuth settings and Resend.
