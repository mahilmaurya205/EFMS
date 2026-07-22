# EFMS production security checklist

Application security is an ongoing process; no deployment can honestly guarantee that no
vulnerability exists. Use this checklist before every production release.

## Required configuration

- Set `NODE_ENV=production`.
- Generate independent random values of at least 32 characters for `JWT_SECRET`,
  `REFRESH_SECRET`, and `DATA_ENCRYPTION_KEY`. Never commit them.
- Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin(s), comma separated.
- Use a dedicated least-privilege MongoDB Atlas user and restrict network access to the backend.
- Keep `SMTP_APP_PASSWORD` only in the hosting secret store. Revoke any credential ever pasted
  into chat, source, logs, tickets, or screenshots and issue a new one.
- Enable Super Admin TOTP 2FA and test OTP delivery before storing real financial data.

## Hosting controls

- Redirect HTTP to HTTPS and enable HSTS at the edge.
- Add frontend headers: a strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`.
- Keep backups encrypted and access-controlled; test a restore at least quarterly.
- Alert on repeated 401/403/429/500 responses. Never log bodies, auth headers, cookies, OTPs,
  passwords, or proof documents.

## Release gate

```bash
npm ci
npm audit --omit=dev
npm run build
```

Manually test expired sessions, every non-admin role against direct API URLs, invalid file
uploads, logout/password session revocation, backup restore, and PDF exports. Review dependencies
monthly and apply security updates after staging verification.

## Incident response

Disable affected accounts, revoke sessions, rotate JWT and SMTP secrets, preserve audit/database
snapshots, and restore only from a verified backup. Rotating `DATA_ENCRYPTION_KEY` requires a
controlled migration because existing encrypted fields otherwise become unreadable.
