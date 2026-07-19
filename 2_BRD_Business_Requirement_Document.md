# Business Requirement Document (BRD)
## Expense & Finance Management System (EFMS)

**Document Version:** 1.0

---

## 1. Business Objectives

1. Eliminate unauthorized or untracked company spending.
2. Ensure every expense and income transaction passes through an approval and verification chain before it affects the books.
3. Provide management real-time visibility into cash, bank, and profitability position.
4. Replace ad-hoc, paper-based vouchers/invoices with digital, numbered, PDF-based records.
5. Maintain an audit trail strong enough that year-end CA/auditor handover requires no reconciliation against a separate accounting tool.
6. Reduce manual salary/expense reconciliation effort via automated salary adjustment and advance salary handling.

## 2. Stakeholders

| Stakeholder | Interest |
|---|---|
| Super Admin / Business Owner | Overall financial control, reporting, backups |
| Admin / Finance Head | Approvals, cash & voucher control, employee management |
| HR | Salary, advances, employee documents |
| Accountant | Day-to-day bookkeeping: income, expense, vouchers, GST, bank |
| Employees | Raising expenses/requirements, refunds, advances, tracking their own status |
| External CA / Auditor | Year-end review of ledgers, vouchers, GST, and audit trail |

## 3. Business Rules

### 3.1 Approval Rules (Configurable Approval Engine)
- **BR-01:** Expenses above ₹2,000 require Manager → Account → Admin approval, in that order.
- **BR-02:** Expenses above ₹25,000 require Manager → Finance Head → Director approval, in that order.
- **BR-03:** Threshold values and chain composition must be configurable by Super Admin/Admin without code changes.
- **BR-04:** An expense cannot move to "Approved" status while any required approver in its chain is still pending.
- **BR-05:** A rejection at any stage halts the workflow and notifies the requester; it does not proceed to later stages.

### 3.2 Expense & Purchase Rules
- **BR-06:** An expense request must specify category, purpose, amount, vendor, and expected date before submission; quotation upload is optional at request stage but invoice upload is mandatory before final account verification.
- **BR-07:** Every purchase must end in a Voucher and a Ledger entry — no expense is considered "posted" without both.
- **BR-08:** If an employee used personal money for an approved expense, the system must trigger a Salary Adjustment automatically; this is not optional or manual.

### 3.3 Cash Rules
- **BR-09:** Every cash movement (withdrawal, deposit, transfer, adjustment) must be traceable end-to-end: Bank → Cash Box → Utilization → Expense/Voucher.
- **BR-10:** A daily cash closing is mandatory, recording Opening Balance, Received, Spent, Closing Balance, and any Cash Difference for reconciliation.
- **BR-11:** Admin must always be able to answer "where did this cash go" for any withdrawal.

### 3.4 Voucher & Invoice Rules
- **BR-12:** Voucher numbers are auto-generated, sequential, and unique per voucher type (PV, RV, JV, CV, etc.) — no manual entry, no gaps, no reuse.
- **BR-13:** Every voucher and invoice must be renderable as a PDF containing at minimum: number, date, amount, purpose, parties involved, and status.
- **BR-14:** All invoices must include GST details, company logo, QR code, and digital signature where applicable.

### 3.5 Refund & Salary Rules
- **BR-15:** Refunds require bill upload and verification before approval; approval generates a voucher and updates salary/payment records.
- **BR-16:** Salary Adjustment formula: `Net Salary = Basic Salary − Expense Amount`, and a full history of adjustments per employee must be retained (never overwritten).
- **BR-17:** Advance Salary requests, once approved, must automatically deduct from the following month's salary run.

### 3.6 Audit & Data Integrity Rules
- **BR-18:** No financial or audit record may be hard-deleted; deletion requests must result in an **archive** state only.
- **BR-19:** Every change to a financial record must capture Old Value, New Value, Who, When, IP Address, Device, and (where applicable) Reason.
- **BR-20:** Reports and statements (Balance Sheet, P&L, Trial Balance, Cash Flow, GST) must be derivable purely from posted ledger entries — no manual "top-up" entries permitted outside the voucher/journal mechanism.

## 4. Workflow Narratives

### 4.1 Expense Workflow
Employee raises a request → routed through the applicable approval chain (BR-01/BR-02) → on approval, employee purchases and uploads invoice → Accountant verifies → expense is approved and posted to the ledger (double-entry) → if personal funds were used, salary is adjusted → request closed.

### 4.2 Purchase Workflow
Need raised → approved → purchased → bill uploaded → payment verified → voucher created → expense posted → ledger updated → reports refreshed.

### 4.3 Cash Withdrawal Workflow
Bank balance reduced → cash withdrawn to cash box → cash utilized against expenses → vouchers generated for utilization → remaining cash carried forward → daily cash closing performed.

### 4.4 Refund Workflow
Employee requests refund with bills → verified → approved → voucher created → payment released → salary/payment record updated.

### 4.5 Salary Adjustment & Advance Salary
Salary Adjustment: triggered automatically post-expense-approval when personal funds were used.
Advance Salary: employee requests → approved → voucher issued → automatically deducted the following month.

## 5. Success Criteria / KPIs

- 100% of expenses above defined thresholds pass through the configured approval chain (zero bypass).
- 100% of cash movements reconcile daily with zero unexplained difference beyond a defined tolerance.
- Average expense-to-close cycle time reduced versus the manual/paper process (baseline to be measured post-launch).
- Zero manual journal entries required to produce month-end financial statements.
- Full audit trail coverage: 100% of create/update/archive actions on financial entities are logged with before/after values.
- Reduction in time to prepare year-end CA/audit package (target: same-day export vs. multi-week manual compilation).

## 6. Out of Scope (v1 / MVP)

- Multi-currency accounting.
- Direct integrations with Tally, Zoho Books, Razorpay, PhonePe, GST Portal, Bank APIs, UPI, Biometric Attendance, and Payroll systems (planned future phase per SRS Section 6.2).
- AI-based fraud detection, OCR auto-capture, and predictive cash flow (planned future phase per SRS Section 6.3).
