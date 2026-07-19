# Software Design Document (SDD)
## Expense & Finance Management System (EFMS)

**Document Version:** 1.0

---

## 1. Architecture Overview

### 1.1 Technology Stack

**Frontend**
- React.js (TypeScript)
- Tailwind CSS
- shadcn/ui component library
- TanStack Query (server-state/data fetching)
- React Hook Form (form state & validation)

**Backend**
- Node.js + Express.js
- Prisma ORM
- PostgreSQL (primary relational store — required for double-entry integrity and relational reporting)
- Redis (caching, session/rate-limit state, queue backing store)
- BullMQ (background job processing: PDF generation, notifications, reminders, backups)

**Storage**
- AWS S3 or Cloudflare R2 for documents, invoices, vouchers, and generated PDFs

**Authentication**
- JWT access tokens + refresh tokens
- Role-Based Access Control (RBAC)
- Optional 2FA (TOTP-based)

**PDF & Document Generation**
- PDFKit or Puppeteer for PDF rendering
- ExcelJS for Excel report export
- Digital signature support for vouchers/invoices

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React SPA)                   │
│   Dashboard / Expense / Voucher / Invoice / Reports UI   │
└───────────────────────────┬───────────────────────────────┘
                            │ HTTPS (REST/JSON)
┌───────────────────────────▼───────────────────────────────┐
│                Express.js API Gateway Layer                │
│   AuthN/AuthZ Middleware (JWT + RBAC) · Rate Limiting      │
└──────┬───────────────┬───────────────┬──────────┬─────────┘
       │               │               │          │
┌──────▼─────┐  ┌──────▼──────┐ ┌─────▼─────┐ ┌───▼──────────┐
│ Core Domain│  │ Accounting  │ │ Document/  │ │ Notification │
│ Services   │  │ Engine      │ │ PDF Service│ │ Service      │
│ (Expense,  │  │ (Double-    │ │ (S3/R2 +   │ │ (Email/SMS/  │
│ Income,    │  │ Entry       │ │ ExcelJS/   │ │ WhatsApp/    │
│ Voucher,   │  │ Ledger)     │ │ Puppeteer) │ │ Push)        │
│ Cash, HR)  │  │             │ │            │ │              │
└──────┬─────┘  └──────┬──────┘ └─────┬──────┘ └───┬──────────┘
       │               │              │            │
       └───────┬────────┴──────┬───────┴─────┬──────┘
               │               │             │
         ┌─────▼─────┐  ┌──────▼─────┐ ┌─────▼─────┐
         │ PostgreSQL │  │   Redis    │ │  S3 / R2  │
         │ (Prisma)   │  │ (Cache/Q)  │ │ (Files)   │
         └────────────┘  └────────────┘ └───────────┘
               │
         ┌─────▼─────┐
         │  BullMQ    │  ← background jobs: PDF gen, reminders,
         │  Workers   │    auto-backup, notification dispatch
         └────────────┘
```

### 1.3 Deployment Considerations
- Stateless API instances behind a load balancer, horizontally scalable.
- BullMQ workers run as separate scalable processes from the API.
- Daily automated PostgreSQL backups plus cloud backup of the S3/R2 document bucket (per FR: Auto Backup).
- Environment separation: dev / staging / production, each with isolated database and storage buckets.
- Multi-tenancy: each Company record scopes all child data; row-level scoping enforced at the ORM/service layer.

---

## 2. Module Design

Each module maps 1:1 to a service layer in the backend and a route namespace in the API. Modules (aligned with the Suggested Database Modules):

1. User Management & Auth
2. Role & Permission (RBAC)
3. Employee Management
4. Department Management
5. Income Management
6. Expense Management
7. Expense Approval Engine
8. Purchase Request / Purchase Order
9. Vendor Management
10. Customer Management
11. Cash Book
12. Bank Book
13. Ledger / Chart of Accounts (double-entry core)
14. Voucher Management
15. Invoice Management
16. Refund Management
17. Salary Adjustment
18. Payroll (Advance Salary + Salary Slip)
19. Document Management System
20. Activity Logs
21. Notifications
22. Reports
23. Settings
24. Audit Trail
25. Backup Management

---

## 3. API Design (Representative Endpoints)

### 3.1 Auth
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/2fa/verify
```

### 3.2 Users & Roles
```
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
GET    /api/roles
POST   /api/roles
PATCH  /api/roles/:id/permissions
```

### 3.3 Expense
```
POST   /api/expenses                     — create expense request
GET    /api/expenses?status=&category=   — list/filter
GET    /api/expenses/:id
PATCH  /api/expenses/:id/approve         — approval-chain step
PATCH  /api/expenses/:id/reject
POST   /api/expenses/:id/invoice         — upload purchase invoice
PATCH  /api/expenses/:id/verify          — accountant verification
```

### 3.4 Purchase
```
POST   /api/purchase-requests
PATCH  /api/purchase-requests/:id/approve
POST   /api/purchase-orders
PATCH  /api/purchase-orders/:id/receive
```

### 3.5 Cash & Bank
```
POST   /api/cash/withdraw
POST   /api/cash/deposit
POST   /api/cash/close-day
GET    /api/cash-book?date=
GET    /api/bank-accounts
POST   /api/bank-accounts/:id/entries
GET    /api/bank-accounts/:id/statement
```

### 3.6 Vouchers & Invoices
```
POST   /api/vouchers                     — type: PV/RV/JV/CV/Refund/Salary/Advance/Expense
GET    /api/vouchers/:id/pdf
POST   /api/invoices                     — type: Quotation/Proforma/Tax/Receipt/CreditNote/DebitNote
GET    /api/invoices/:id/pdf
```

### 3.7 Refund / Salary / Advance
```
POST   /api/refunds
PATCH  /api/refunds/:id/approve
POST   /api/salary-adjustments           — auto-triggered by expense service, also viewable via API
POST   /api/advance-salary
PATCH  /api/advance-salary/:id/approve
```

### 3.8 Documents
```
POST   /api/documents                    — upload
GET    /api/documents?folder=&type=
GET    /api/documents/:id/versions
POST   /api/documents/:id/share
```

### 3.9 Reports & Search
```
GET    /api/reports/expense?period=&format=pdf|xlsx|csv
GET    /api/reports/income?...
GET    /api/reports/gst?...
GET    /api/search?q=
```

### 3.10 Audit & Activity
```
GET    /api/activity-logs?user=&action=&from=&to=
GET    /api/audit-trail/:entityType/:entityId
```

All list endpoints support pagination, filtering, and sorting query parameters. All mutating endpoints are wrapped in a database transaction that (a) writes the domain record, (b) writes the corresponding ledger entries, and (c) writes the activity/audit log entry atomically.

---

## 4. Authentication & Authorization Design

- **JWT access token** (short-lived, e.g., 15 min) + **refresh token** (longer-lived, rotated on use, stored hashed).
- **RBAC**: permissions are attached to Roles, Roles are attached to Users; every API route declares the required permission(s); middleware checks the JWT-derived role/permission set before the controller executes.
- **2FA**: optional TOTP enrollment per user; enforced at login for elevated roles (Super Admin/Admin) if enabled by policy.
- **Session Timeout & IP Restriction**: configurable per company in Settings; enforced in the auth middleware.

---

## 5. Double-Entry Accounting Engine Design

A dedicated **Ledger Service** sits beneath all money-moving modules (Expense, Income, Refund, Salary, Cash, Bank). No module writes financial state directly — each posts a **Journal Entry** consisting of balanced Debit/Credit lines against the **Chart of Accounts**.

Example postings:
- Employee Expense ₹2,500 → Dr. Office Expense ₹2,500 / Cr. Employee Payable ₹2,500
- Refund Paid ₹2,500 → Dr. Employee Payable ₹2,500 / Cr. Cash/Bank ₹2,500

This guarantees:
- Every Voucher maps to exactly one balanced Journal Entry.
- Balance Sheet, P&L, Trial Balance, and Cash Flow Statement are derived views (SQL aggregations) over the Journal Entry / Ledger tables — never separately maintained.
- GST Reports are derived from Income/Expense records tagged with GST fields, cross-checked against the ledger.

---

## 6. Background Job Design (BullMQ Queues)

| Queue | Jobs |
|---|---|
| `pdf-generation` | Invoice, Voucher, Salary Slip, Expense/Cash/Income Report PDFs |
| `notifications` | Email, SMS, WhatsApp, Push dispatch on approval/rejection/expense/income/salary/voucher/invoice events |
| `reminders` | Document expiry reminders, due-date reminders for pending approvals |
| `backup` | Daily DB dump + document bucket sync to backup storage |
| `reports` | Heavy report/export generation (Excel/CSV/PDF) run async, result link delivered via notification |

---

## 7. Security Design

- Encryption in transit (TLS) and at rest (DB + object storage encryption).
- RBAC + JWT as described above.
- Full activity logging middleware capturing Date, Time, User, IP, Browser/User-Agent, Action, Old Value, New Value for every mutating request.
- Audit Trail entities are **append-only**; delete operations across the system are implemented as an `is_archived` flag flip, never a row delete.
- Daily backups (DB + object storage) retained per configured retention policy.

---

## 8. Future Integration Design Notes

Integration points are designed as adapters behind a common interface so each can be added without touching core domain logic:
- **Accounting/ERP**: Tally, Zoho Books (export/sync adapter over the Ledger Service).
- **Payments**: Razorpay, PhonePe, UPI, Bank APIs (adapter feeding Bank/Cash module).
- **Storage**: Google Drive, OneDrive, Dropbox (alternate document backends behind the existing Document Service interface).
- **Comms**: WhatsApp Business API (alongside existing notification channels).
- **Compliance**: GST Portal filing adapter.
- **HR/Ops**: Biometric Attendance, Payroll system sync.

---

## 9. Future AI Feature Design Notes (Roadmap)

These are designed as optional services layered on top of the core data model, not core dependencies:
- Fraud detection: anomaly-detection job over Expense/Voucher tables (duplicate bill hashing, spend-pattern outliers).
- OCR: pre-processing step on Document upload for bills/invoices, populating suggested Expense/Income fields.
- Finance summary & cash flow prediction: scheduled job summarizing Ledger data using an LLM/analytics service.
- Natural-language search: a query-translation layer in front of the existing Search/Report APIs.
