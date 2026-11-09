# Emergency authenticator reset

Use this only when a Kynetic admin cannot sign in and no other admin can reset their authenticator from **Admin → Users**.

It removes the authenticator, signs that person out, and writes `user.2fa_emergency_reset` to the audit log. It does not create a password and it does not print secrets.

Run it with the database **owner** URL (`DATABASE_URL_MIGRATE`), not the app role:

```bash
cd crm
DATABASE_URL_MIGRATE='postgres://kynetic_owner:…@host/db' \
  bun scripts/emergency-reset-staff-totp.ts \
  --email admin@example.com \
  --confirm RESET-TOTP
```

The confirmation phrase must be exact. A client email is refused. After it succeeds, that admin signs in with Google and scans a new QR code.
