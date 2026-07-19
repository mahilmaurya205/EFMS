# UI/UX Functional Specification Document (FSD)
## Expense & Finance Management System (EFMS)

**Document Version:** 1.0

This document specifies screen-by-screen behavior, field-level validation, and role-based visibility for EFMS.

---

## 1. Login & Authentication Screen

**Purpose:** Authenticate a user into their company workspace.

**Fields:** Email, Password, [2FA Code — conditional]

**Validations:**
- Email must be valid format; required.
- Password required, min 8 characters.
- Account lockout after configurable failed attempts (Settings).
- If 2FA is enabled for the account, a second screen requests a 6-digit TOTP code.

**Actions:** Login, Forgot Password.

**Visibility:** Public (unauthenticated) screen.

---

## 2. Dashboard

**Purpose:** Role-specific financial snapshot and quick navigation.

**Widgets (role-filtered):**
- Today's Income / Today's Expense / Cash in Hand / Bank Balance (all roles with financial visibility)
- Pending Approvals / Pending Vouchers / Pending Expense Requests / Pending Refunds (Admin, Super Admin, Manager)
- Today's Collection / Monthly Profit / Monthly Loss (Admin, Super Admin, Accountant)
- Expense by Category / Income by Category / Top Expense Employees (Admin, Super Admin)
- Cash Flow Graph / Monthly Graph / Expense Pie Chart (Admin, Super Admin, Accountant)
- Recent Activities / Recent Uploaded Documents (all roles, scoped to what they're permitted to see)

**Employee view:** Simplified — own pending requests, own recent activity, "New Expense Request" quick action, view own salary summary.

**Behavior:** Widgets load asynchronously; each has a "View All" link to its full module screen.

---

## 3. Expense Request Screen

**Purpose:** Employee raises a new expense request.

**Fields:**
| Field | Type | Validation |
|---|---|---|
| Category | Dropdown (predefined + Custom) | Required |
| Purpose | Text area | Required, max 500 chars |
| Amount | Currency (₹) | Required, > 0, numeric |
| Vendor | Autocomplete/Dropdown | Optional |
| Expected Date | Date picker | Required, ≥ today |
| Quotation Upload | File (PDF/Image) | Optional, max file size per Settings |

**Actions:** Save as Draft, Submit for Approval.

**Post-Submit Behavior:** Status changes to "Pending Manager Approval"; approval chain initialized per amount threshold (BR-01/BR-02); notification sent to first approver.

**Visibility:** Employee (create), Manager/Admin/Accountant (view within approval queue).

---

## 4. Expense Approval Screen

**Purpose:** Approver reviews and acts on a pending expense.

**Displayed Info:** Requester, category, purpose, amount, vendor, expected date, quotation (if any), current approval step, full approval chain with statuses.

**Actions:** Approve, Reject (reason required on reject), Request More Info (optional comment).

**Validation:** Rejection requires a non-empty reason (min 10 characters) so the requester understands why.

**Behavior:** On Approve, request advances to next step in chain or, if last step, status becomes "Approved" and the employee is notified to proceed with purchase.

**Post-Approval — Invoice Upload (Employee):** Employee uploads purchase invoice (required, PDF/Image); marks "Paid using personal funds" checkbox if applicable.

**Account Verification Screen (Accountant):** Reviews invoice against approved amount/category; Approves (posts voucher + ledger entry, triggers Salary Adjustment if the personal-funds checkbox was set) or Sends Back for correction.

---

## 5. Purchase Request / Purchase Order Screens

**Purchase Request Screen:** Fields — Item Description, Estimated Amount, Justification. Action: Submit for Approval.

**Purchase Order Screen (Admin/Accountant):** Fields — Vendor (select/create), PO Number (auto-generated, read-only), Amount, Delivery Date. Actions: Issue PO, Mark Received (triggers Bill Upload step), Mark Payment Verified (triggers Voucher Creation).

---

## 6. Cash Book Screen

**Purpose:** Daily cash ledger view and closing.

**Table Columns:** Date, Opening Balance, Received, Spent, Closing Balance, Purpose, Voucher No., Done By, Approved By.

**Actions:**
- "Withdraw from Bank" (opens Cash Withdrawal modal: Bank Account select, Amount, required)
- "Record Cash Entry" (Received/Spent, Amount, Purpose, linked Voucher)
- "Close Day" — locks the day's entries, computes Cash Difference (Opening + Received − Spent − Closing); if difference ≠ 0, a mandatory remarks field appears.

**Validation:** Cannot close a day twice; cannot backdate entries into an already-closed day without Admin override + audit note.

**Visibility:** Accountant (entry), Admin/Super Admin (entry + closing + override).

---

## 7. Income Entry Screen

**Fields:** Source (dropdown: Client Payment, AMC, Subscription, Consultancy, Software/Website/App Development, Training, Other), Client (autocomplete), Amount, GST, Payment Mode, Bank Account (conditional on mode), Reference No., Linked Invoice (optional/create new).

**Validation:** Amount required, > 0; GST auto-calculated if GST-applicable toggle is on; Remaining Amount auto-computed as Amount − Paid-to-date for partial payments.

**Status Badge:** Pending / Partial / Paid, computed from Remaining Amount.

---

## 8. Invoice Generation Screen

**Purpose:** Create Quotation / Proforma / Tax Invoice / Receipt / Credit Note / Debit Note / Payment Receipt.

**Fields:** Type (select), Customer (select/create), Line Items (Description, Qty, Unit Price — dynamic add/remove rows), GST %, Notes.

**Live Preview:** Shows PDF preview with Company Logo, QR Code, and Digital Signature placeholder before final generation.

**Actions:** Save Draft, Generate & Download PDF, Email to Customer.

**Validation:** At least one line item required; totals auto-calculated and read-only.

---

## 9. Voucher Screen

**Purpose:** Create/view vouchers of any type (Payment, Receipt, Journal, Contra, Refund, Salary, Advance, Expense).

**Fields:** Type (select — determines numbering series, e.g. PV/RV/JV), Amount, Purpose, Receiver, Given By (auto-filled from logged-in user, editable by Admin), linked source record (Expense/Refund/Income/Purchase, where applicable).

**Auto-Behavior:** Voucher Number is generated on save and is read-only thereafter (e.g., PV00001); cannot be edited or reused.

**Actions:** Save & Generate PDF, Cancel Voucher (requires reason; status changes to "cancelled," never deleted).

---

## 10. Refund Request Screen

**Employee View:** Amount, Bill Upload (required), Reason.
**Verification View (Accountant):** Verify bill against amount; Approve/Reject.
**Approval View (Admin):** Final approval → auto-generates Refund Voucher → triggers payment and salary/payment record update.

**Validation:** Bill upload mandatory before submission; amount must be > 0.

---

## 11. Salary Adjustment & Advance Salary Screens

**Salary Adjustment (HR/Accountant view, read-mostly):** Table per employee — Basic Salary, Expense Amount(s), Net Salary, linked Expense Request(s), Period. Auto-populated; manual entries only via an explicit "Manual Adjustment" action with mandatory reason (fully audited).

**Advance Salary Request (Employee):** Amount, Reason. Submit → Approval (HR/Admin) → Voucher generated → flagged for deduction in the following month's salary run (shown as a locked line item on the next Salary Slip).

**Salary Slip Screen:** Read-only per-employee view/download of Gross, Deductions (incl. advance/adjustment), Net Pay, as PDF.

---

## 12. Bank Management Screen

**Account List:** Bank Name, Account Number (masked), Current Balance.
**Account Detail:** Income, Expense, Transfer history; Statement (filterable by date range, exportable PDF/Excel).

**Actions:** Add Bank Account (Admin/Super Admin only), Record Bank Entry, Record Transfer between accounts (creates a Contra Voucher automatically).

---

## 13. Document Management Screen

**Layout:** Folder-tree navigation (left panel) + file grid/list (right panel).

**Fields on Upload:** File, Folder/Category (GST/PAN/Aadhar/Agreements/Invoices/Bills/Salary Slips/Offer Letters/Client/Vendor/Photos/Videos/etc.), Expiry Date (optional).

**Actions:** Upload, Preview, Download, Share (generates a scoped link or in-app share to a user/role), Version History (view/restore previous versions).

**Behavior:** If Expiry Date is set, an automated reminder notification fires per Settings-defined lead time (e.g., 30 days before expiry).

**Validation:** Restricted file types/max size per Settings; virus/malware scan on upload (backend).

---

## 14. Activity Log & Audit Trail Screens

**Activity Log (Admin/Super Admin):** Filterable table — Date, Time, User, IP, Browser, Action. Read-only.

**Audit Trail (per-entity, accessed from any record's "History" tab):** Who Changed, What Changed (Old Value vs New Value diff view), When Changed, Reason (if provided), IP Address, Device.

**Behavior:** No delete/edit controls anywhere in these screens — strictly read-only, consistent with the "archive not delete" rule.

---

## 15. Approval Engine Configuration Screen (Settings)

**Purpose:** Admin/Super Admin configures approval chains.

**Fields:** Rule Name, Applies To (Expense/Refund/Purchase), Amount Threshold (From–To), Ordered list of Approver Roles (drag-to-reorder).

**Validation:** Threshold ranges must not overlap ambiguously for the same entity type; at least one approver role required per rule.

**Example rows shown:** "> ₹2,000 → Manager → Account → Admin"; "> ₹25,000 → Manager → Finance Head → Director".

---

## 16. Notifications Center

**In-App Panel:** List of notifications (Approval, Rejected, Expense, Income, Salary, Voucher, Invoice events), read/unread state, click-through to source record.

**Settings Screen:** Per-user channel preferences (Email/WhatsApp/SMS/Push/In-App toggles), subject to company-level channel availability.

---

## 17. Reports Screen

**Purpose:** Generate and export operational/statutory reports.

**Fields:** Report Type (Expense/Income/Cash/Bank/Voucher/Salary/GST/Employee Expense/Category-wise/Vendor-wise), Period (Monthly/Quarterly/Yearly/Custom Range), Format (PDF/Excel/CSV).

**Behavior:** Large exports run as a background job (per SDD Section 6); user is notified with a download link when ready. Small/short-range reports render synchronously with an inline preview before export.

---

## 18. Global Search Screen

**Field:** Single search box, triggers on-type suggestions and full results on Enter.

**Result Categories (tabbed):** Invoices, Vouchers, Employees, Vendors, Clients, Expenses, Income, Documents.

**Behavior:** Results are permission-filtered — a user only sees records within their role's visibility scope, even in search results.

---

## 19. Role & Permission Management Screen (Settings)

**Purpose:** Super Admin/Admin manages roles and their permissions.

**Fields:** Role Name, Permission checklist grouped by module (Expense, Voucher, Cash, Bank, Document, Reports, etc.).

**Validation:** System roles (Super Admin) cannot be deleted or stripped of core administrative permissions.

---

## 20. Cross-Cutting UI Rules

- **Currency formatting:** All amounts display in ₹ (INR) with thousands separators (Indian numbering system, e.g., ₹1,00,000).
- **Status badges:** Consistent color coding across modules (e.g., Pending = amber, Approved = green, Rejected = red, Archived = grey).
- **Empty states:** Every list/table screen defines an empty-state message with a primary call-to-action (e.g., "No expenses yet — Create your first request").
- **Confirmation dialogs:** Required before any irreversible-looking action (Cancel Voucher, Archive Document, Close Cash Day).
- **Mobile responsiveness:** Expense submission, approvals, and dashboard summaries must be fully usable on mobile viewports; complex tables (Ledger, Reports) may offer a simplified mobile summary with a "view on desktop for full detail" note.
