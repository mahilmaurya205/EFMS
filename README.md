# Expense & Finance Management System

Full-stack starter for EFMS with:

- Backend: Node.js, Express, TypeScript, MongoDB/Mongoose
- Frontend: React, TypeScript, Vite
- Core modules: auth, dashboard, expenses, approvals, vouchers, journal entries, invoices, cash/bank, audit activity
- Analytics: date-filtered P&L, monthly cash flow, category/employee/vendor rankings, CSV/Excel/PDF export
- Controls: monthly category/department budgets and bank-statement reconciliation
- Security: rotating refresh sessions, login throttling, optional TOTP 2FA, password reset, encrypted sensitive employee fields
- Data safety: integrity-chained audit records, JSON backup/restore and scheduled backup command

## Setup

```bash
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.
Frontend runs on `http://localhost:5173`.

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`.

For production, set independent long random values for `JWT_SECRET`, `REFRESH_SECRET`, and
`DATA_ENCRYPTION_KEY`. The encryption key must remain stable or encrypted employee data cannot
be decrypted.

## Reports and bank import

- Reports support date filters and CSV, Excel-compatible XLS, and browser Print/Save as PDF.
- Bank reconciliation accepts CSV headers: `date,description,reference,debit,credit,balance`.
- Invoice and voucher print views include GST totals, a scannable verification QR and an
  authorized-signatory block. Numbering is allocated atomically by document type.

## Backups

Super Admin can download and restore versioned JSON backups from **Backup & Restore**. To create
a filesystem snapshot (latest 14 retained):

```bash
npm run backup
```

Schedule that command daily with Windows Task Scheduler, cron, or the hosting platform scheduler.
Restore requires the explicit phrase `RESTORE EFMS` and never overwrites audit-log history.

## Security notes

- Access tokens expire after 15 minutes; refresh tokens rotate and expire after 7 days.
- Five failed login attempts trigger a 15-minute IP/account cooldown.
- Password reset tokens expire after 30 minutes. In development only, the API returns the reset
  token; connect an email provider before production.
- TOTP 2FA can be enabled from **Backup & Restore** using any authenticator app.

Production startup rejects weak/reused secrets and non-HTTPS frontend origins. Set
`NODE_ENV=production` and an exact, comma-separated `CLIENT_ORIGIN` allowlist. Access tokens are
kept in session storage; rotating refresh tokens use Secure, HttpOnly cookies. Backend permission
checks protect each module independently of sidebar visibility.

Before launch, follow [SECURITY.md](SECURITY.md), enable MongoDB Atlas IP/user restrictions,
configure hosting security headers, and run `npm audit --omit=dev` plus `npm run build`.
