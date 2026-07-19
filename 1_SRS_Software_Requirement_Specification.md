# Software Requirement Specification (SRS)
## Expense & Finance Management System (EFMS)

**Document Version:** 1.0
**Status:** Draft for Review
**Prepared For:** EFMS Development Project

---

## 1. Introduction

### 1.1 Purpose
This document specifies the complete functional and non-functional requirements for the Expense & Finance Management System (EFMS) — a centralized platform to track every rupee entering and leaving the company, enforce approval-based control over spending, maintain complete activity/audit trails, and produce audit-ready financial records built on a double-entry accounting foundation.

### 1.2 Scope
EFMS will:
- Prevent unauthorized expenses through configurable, multi-level approval workflows.
- Digitize vouchers, invoices, salary adjustments, and cash tracking.
- Maintain a searchable company document repository.
- Generate operational and statutory reports (GST, salary, cash, bank, vouchers).
- Maintain a tamper-evident audit trail sufficient for external CA/auditor review, without needing a separate accounting package.

### 1.3 Definitions, Acronyms, and Abbreviations
| Term | Meaning |
|---|---|
| EFMS | Expense & Finance Management System |
| RBAC | Role-Based Access Control |
| GST | Goods and Services Tax |
| AMC | Annual Maintenance Contract |
| PV/RV/JV/CV | Payment/Receipt/Journal/Contra Voucher |
| 2FA | Two-Factor Authentication |
| JWT | JSON Web Token |
| CA | Chartered Accountant |

### 1.4 References
Source requirement note: "Expense & Finance Management System (EFMS) — Software Requirement & Flow Document" (client-provided, informal draft).

### 1.5 Overview
Section 2 gives an overall product description. Section 3 details user roles. Sections 4 onward specify functional requirements module by module. Section 5 covers non-functional requirements. Section 6 covers external interfaces and future integrations.

---

## 2. Overall Description

### 2.1 Product Perspective
EFMS is a new, standalone, web-based finance and expense platform. It is designed as a system of record for cash, bank, expense, income, payroll-adjustment, and document data, built internally on double-entry bookkeeping so that standard financial statements (Balance Sheet, P&L, Trial Balance, Cash Flow, GST Reports) can be produced directly from transactional data.

### 2.2 Product Functions (Summary)
- Role-based dashboards and approvals
- Expense request → approval → purchase → invoice → posting → salary adjustment (if applicable) lifecycle
- Purchase requisition and purchase order lifecycle
- Cash withdrawal, cash book, and daily cash closing
- Company income tracking across multiple income sources
- Invoice/quotation/receipt generation (PDF, with GST, QR code, digital signature)
- Voucher generation (Payment, Receipt, Journal, Contra, Refund, Salary, Advance, Expense) with auto-numbering
- Refund workflow tied to salary reconciliation
- Salary adjustment and advance salary workflows
- Multi-bank account management
- Full activity logging and an immutable audit module (archive-only, no hard delete)
- Document management with folders, versioning, search, and expiry reminders
- Configurable, amount-based approval engine
- Multi-channel notifications (Email, WhatsApp, SMS, Push, In-App)
- Reporting (Expense, Income, Cash, Bank, Voucher, Salary, GST) in PDF/Excel/CSV
- Global search across invoices, vouchers, employees, vendors, clients, expenses, income, documents

### 2.3 User Classes and Characteristics
See Section 3 for the full role/permission matrix. Roles: Super Admin, Admin, HR, Accountant, Employee.

### 2.4 Operating Environment
Web application accessible via modern browsers (desktop-first, responsive for mobile). Backend services hosted on cloud infrastructure with object storage for documents/PDFs (see SDD for technology choices).

### 2.5 Design and Implementation Constraints
- Must support double-entry accounting under the hood for every financial transaction.
- Audit records cannot be deleted — only archived.
- All monetary values must be traceable to a voucher and a ledger entry.
- Multi-currency is out of scope for v1 (INR only); GST rules assume Indian tax context.

### 2.6 Assumptions and Dependencies
- Company operates in India and requires GST-compliant invoicing.
- Users are internal employees; there is no external customer-facing portal in v1.
- Integrations listed in Section 6.2 (Tally, Zoho Books, Razorpay, etc.) are future-phase and not required for MVP go-live.

---

## 3. User Roles and Permissions

| Role | Key Permissions |
|---|---|
| **Super Admin** | Create company, manage users, approve expenses, manage income, cash management, generate/download reports, view activity logs, manage documents, backup data — full system access |
| **Admin** | Approve requests/expenses/refunds, manage cash, manage vouchers, manage employees, generate reports |
| **HR** | Manage employee salary, expense adjustment, advance salary, salary slips, employee documents |
| **Accountant** | Income entry, expense entry, voucher entry, GST entry, invoice management, bank entry, cash book |
| **Employee** | Raise requirement/expense request, upload bills, view status, apply refund, apply advance salary, view own salary |

**Rule:** Every role's actions are gated by RBAC and logged in the Activity Log (Section 4.17).

---

## 4. Functional Requirements

### 4.1 Dashboard (FR-DASH)
The dashboard shall display, filtered by role-based visibility:
- Today's Income, Today's Expense, Cash in Hand, Bank Balance
- Pending Approvals, Pending Vouchers, Pending Expense Requests, Pending Refunds
- Today's Collection, Monthly Profit/Loss
- Expense by Category, Income by Category, Top Expense Employees
- Cash Flow Graph, Monthly Graph, Expense Pie Chart
- Recent Activities, Recent Uploaded Documents

### 4.2 Expense Categories (FR-CAT)
System shall support predefined categories (Office Expense, Travel, Fuel, Stationery, Food, Internet, Software, Hosting, Server, Laptop, Repair, Marketing, Printing, Salary, Medical, Maintenance, Electricity, Rent, Miscellaneous) plus admin-defined **Custom Category**.

### 4.3 Expense Request & Approval Workflow (FR-EXP)
1. Employee creates a **New Expense Request**: category, purpose, amount, vendor, expected date, optional quotation upload.
2. Request routes through **Manager Approval → Admin Approval** (or the configured approval chain per Section 4.19).
3. On approval, employee purchases the item and **uploads invoice**.
4. Accounts team performs **Account Verification**.
5. Expense is marked **Approved**.
6. If personal funds were used, system triggers **Salary Adjustment** (Section 4.13).
7. Request is **Closed**, and all state transitions are logged.

### 4.4 Purchase Workflow (FR-PUR)
Need Raised → Approval → Purchase → Bill Upload → Payment Verification → Voucher Creation → Expense Posted → Ledger Updated → Reports Updated. Every step is timestamped and attributable to a user.

### 4.5 Cash Withdrawal Workflow (FR-CASH-WD)
Bank → Cash Withdraw → Cash Box → Cash Utilization → Expense → Voucher → Remaining Cash → Cash Closing. The system shall always be able to trace Bank → Cash → destination of funds for any admin query.

### 4.6 Cash Book (FR-CB)
Every cash transaction records: Date, Opening Balance, Received, Spent, Closing Balance, Purpose, Voucher Number, Done By, Approved By.

### 4.7 Company Income Module (FR-INC)
Income sources: Client Payment, AMC, Subscription, Consultancy, Software Development, Website Development, App Development, Training, Other.
Each income record stores: Invoice, Payment Mode, Bank, Reference, GST, Client, Amount, Remaining, Status.

### 4.8 Invoice Management (FR-INV)
Generate: Quotation, Proforma Invoice, Tax Invoice, Receipt, Credit Note, Debit Note, Payment Receipt. All documents are rendered as PDF with Company Logo, QR Code, Digital Signature, and GST details.

### 4.9 Voucher Module (FR-VOU)
Voucher types: Payment, Receipt, Journal, Contra, Refund, Salary, Advance, Expense.
Voucher numbers auto-generate per type (e.g., PV00001, RV00001, JV00001).
Each voucher PDF contains: Voucher No, Date, Amount, Purpose, Receiver, Given By, Signature, Status.

### 4.10 Refund Workflow (FR-REF)
Employee → Refund Request → Upload Bills → Verification → Approval → Voucher Created → Payment Done → Salary Updated.

### 4.11 Salary Adjustment (FR-SAL-ADJ)
When an approved expense was paid from personal funds:
`Net Salary = Basic Salary − Expense Amount` (adjustment recorded), with full adjustment history retained per employee.

### 4.12 Advance Salary (FR-SAL-ADV)
Employee → Advance Request → Approval → Voucher → Deduction from next month's salary.

### 4.13 Company Cash Management (FR-CASHMGMT)
Cash Received, Cash Withdrawn, Cash Deposit, Cash Transfer, Cash Adjustment, Cash Verification, Daily Closing with Opening Balance, Closing Balance, and Cash Difference reconciliation.

### 4.14 Bank Management (FR-BANK)
Support multiple bank accounts (e.g., HDFC, ICICI, SBI, Axis, IDFC). Each account view shows Current Balance, Income, Expense, Transfer history, and Statement.

### 4.15 Activity Logs (FR-LOG)
Every action (Login, Logout, Delete, Update, Expense, Approval, Document Upload, Invoice Generated, Voucher Generated, Salary Updated, Reports Downloaded) is logged with Date, Time, User, IP, Browser, Action, Old Value, New Value.

### 4.16 Document Management (FR-DOC)
Stores GST, PAN, Aadhar, Agreements, Invoices, Bills, Salary Slips, Offer Letters, Client/Vendor Documents, Photos, Videos, and files of type PDF/Excel/Word/ZIP/etc.
Features: Folder structure, Search, Preview, Download, Share, Version Control, Expiry Reminder.

### 4.17 Approval Engine (FR-APPR)
Configurable, amount-based multi-level chains. Example:
- Expense > ₹2,000 → Manager → Account → Admin → Approved
- Expense > ₹25,000 → Manager → Finance Head → Director → Approved

### 4.18 Notifications (FR-NOTIF)
Channels: Email, WhatsApp, SMS, Push, In-App.
Triggers: Approval, Rejection, Expense, Income, Salary, Voucher, Invoice events.

### 4.19 Reports (FR-RPT)
Expense, Income, Cash, Bank, Voucher, Salary, GST, Employee Expense, Category-wise, Vendor-wise reports; Monthly/Quarterly/Yearly periods; export to PDF/Excel/CSV.

### 4.20 Global Search (FR-SEARCH)
Search across Invoice Number, Voucher Number, Employee, Vendor, Client, Expense, Income, and Documents.

### 4.21 Audit Module (FR-AUDIT)
Tracks Who/What/When changed, Old Value, New Value, Reason, IP Address, Device. **Records cannot be deleted — only archived.**

### 4.22 PDF Generation (FR-PDF)
Every module (Quotation, Invoice, Voucher, Expense Report, Salary Slip, Cash Report, Income Report, Refund, Approval Letter, Purchase Order) shall generate a PDF representation.

### 4.23 Automation (FR-AUTO)
Auto Voucher Number, Auto Invoice Number, Auto Salary Adjustment, Auto GST computation, Auto PDF generation, Auto Email, Auto Reminder (including Due Reminder), Auto Backup.

---

## 5. Non-Functional Requirements

### 5.1 Security
- RBAC enforced at API and UI layer.
- JWT-based authentication with refresh tokens; optional 2FA.
- Session timeout and IP restriction options.
- Data encryption at rest and in transit.
- Daily and cloud backups.

### 5.2 Auditability
- Full audit trail for every create/update/delete-as-archive action, including old/new value diffs.
- No hard deletes anywhere in financial or audit data.

### 5.3 Performance
- Dashboard widgets should load within acceptable interactive thresholds even as transaction volume grows into the tens of thousands of records per company per year.
- Report generation for standard periods (month/quarter/year) should complete without blocking the UI (asynchronous/background job for heavy exports).

### 5.4 Scalability
- System should support multiple companies (multi-tenant, per Super Admin's "Create Company" capability) without cross-tenant data leakage.

### 5.5 Availability & Reliability
- Daily automated backups; recovery procedures documented.
- Voucher/invoice numbering must be strictly sequential and gap-free per series.

### 5.6 Usability
- Role-specific dashboards; mobile-responsive layouts for approvals and expense submission on the go.

### 5.7 Compliance
- GST-compliant invoice formatting.
- Audit-ready record-keeping suitable for handover to an external CA/auditor without a separate bookkeeping system.

---

## 6. External Interface Requirements

### 6.1 User Interfaces
Web application with role-based dashboards (see FSD document for screen-by-screen detail).

### 6.2 Future Integrations (Out of Scope for MVP, Planned)
Tally, Zoho Books, Razorpay, PhonePe, Google Drive, OneDrive, Dropbox, WhatsApp Business API, GST Portal, Bank APIs, UPI, Biometric Attendance, Payroll systems.

### 6.3 Future AI Features (Roadmap, Not MVP)
AI-based expense fraud detection (duplicate bill/unusual spend detection), OCR-based invoice/bill data extraction, AI monthly finance summaries, cash flow prediction, budget overrun alerts, vendor spend analysis, smart approval recommendations, and natural-language search (e.g., "show all travel expenses for June").

---

## 7. Appendix — Core Accounting Principle

EFMS is built on **double-entry accounting**. Every transaction automatically reflects in the books. Example:

- **Employee Expense ₹2,500** → Debit: Office Expense ₹2,500 / Credit: Employee Payable ₹2,500
- **Refund Paid ₹2,500** → Debit: Employee Payable ₹2,500 / Credit: Cash/Bank ₹2,500

This guarantees that Balance Sheet, Profit & Loss, Trial Balance, Cash Flow Statement, and GST Reports can all be generated automatically, and handed to a CA/auditor without maintaining a parallel accounting system.
