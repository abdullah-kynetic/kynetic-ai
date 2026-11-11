---
type: object
cluster: portal
universe: live
status: verified
entity: crm/src/server/auth/
verified_on: 2026-11-11
verified_at: main migration 1019
---

# Portal sign-in

Invite-only. Clients use emailed one-time sign-in codes. Staff use an authenticator app enrolled through a QR code. Google sign-in, passwords, and recovery codes are not part of the current flow.

## Shape
- Modules: email OTP, TOTP enrollment, sessions, invite activation, and audit logging.
- Staff use an authenticator app; clients use emailed codes.

## If you change this
- **Hits:** `crm/tests/*`, `crm/src/server/auth/`, D-026, email templates, [[portal-tenancy-rls]].
- Production verification is a separate release check; this map entry does not probe live auth.
