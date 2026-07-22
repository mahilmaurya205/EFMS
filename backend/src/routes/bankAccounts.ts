import { Router } from "express";
import { z } from "zod";
import { requireAnyPermission, requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { BankAccount } from "../models/BankAccount.js";
import { Earning } from "../models/Earning.js";
import { OperationalRecord } from "../models/OperationalRecord.js";
import { Expense } from "../models/Expense.js";
import { Transfer } from "../models/Transfer.js";
import { Voucher } from "../models/Voucher.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";
import { BankStatementEntry } from "../models/BankStatementEntry.js";
import { Payroll } from "../models/Payroll.js";

export const bankAccountsRouter = Router();

bankAccountsRouter.use(requireAuth);

const bankAccountPayload = z.object({
  bankName: z.string().min(2),
  accountNumber: z.string().min(2),
  currentBalance: z.number().min(0).default(0),
  isActive: z.boolean().optional()
});

function accountLabel(account: { bankName: string; accountNumber: string }) {
  return `${account.bankName} - ${account.accountNumber}`;
}

function bankRecordEffect(record: { status: string; amount: number }) {
  const status = record.status.toLowerCase();
  if (["credit", "received", "deposit", "active"].includes(status)) return record.amount;
  if (["debit", "spent", "withdrawn", "payment"].includes(status)) return -record.amount;
  return 0;
}

bankAccountsRouter.get(
  "/",
  requireAnyPermission("bankAccounts", "earnings", "expenses", "transfers", "vouchers", "statements", "reconciliation", "payroll"),
  asyncHandler(async (_req, res) => {
    const [accounts, earnings, bankRecords, expenses, transfers, vouchers] = await Promise.all([
      BankAccount.find({ isArchived: false }).sort({ createdAt: -1 }).lean(),
      Earning.find({ status: { $ne: "archived" }, paymentMode: { $ne: "cash" } }).lean(),
      OperationalRecord.find({ module: "bank", status: { $ne: "archived" } }).lean(),
      Expense.find({ status: { $ne: "archived" }, paidFrom: "office", paymentMode: { $ne: "cash" } }).lean(),
      Transfer.find({ status: { $ne: "archived" } }).lean(),
      Voucher.find({ status: "issued", type: { $ne: "receipt" }, paymentMode: { $ne: "cash" } }).lean()
    ]);

    const accountsWithBalance = accounts.map((account) => {
      const label = accountLabel(account);
      const earningTotal = earnings
        .filter((earning) => earning.bankAccount === label || earning.bankAccount === account.bankName || earning.bankAccount === account.accountNumber)
        .reduce((sum, earning) => sum + earning.paidAmount, 0);
      const bankBookTotal = bankRecords
        .filter((record) => {
          const fields = record.fields as Record<string, unknown>;
          return fields.bankName === account.bankName || fields.accountNumber === account.accountNumber || record.title === account.bankName || record.title === label;
        })
        .reduce((sum, record) => sum + bankRecordEffect(record), 0);
      const officeExpenseTotal = expenses
        .filter((expense) => expense.bankAccount === label || expense.bankAccount === account.bankName || expense.bankAccount === account.accountNumber)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const transferTotal = transfers
        .filter((transfer) => transfer.bankAccount === label || transfer.bankAccount === account.bankName || transfer.bankAccount === account.accountNumber)
        .reduce((sum, transfer) => sum + (transfer.type === "cash_to_bank" ? transfer.amount : -transfer.amount), 0);
      const voucherTotal = vouchers
        .filter((voucher) => voucher.bankAccount === label || voucher.bankAccount === account.bankName || voucher.bankAccount === account.accountNumber)
        .reduce((sum, voucher) => sum + voucher.amount, 0);
      return { ...account, openingBalance: account.currentBalance, isActive: account.isActive !== false, currentBalance: account.currentBalance + earningTotal + bankBookTotal - officeExpenseTotal + transferTotal - voucherTotal };
    });

    res.json(accountsWithBalance);
  })
);

bankAccountsRouter.post(
  "/",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(async (req, res) => {
    const data = bankAccountPayload.parse(req.body);
    const account = await BankAccount.create(data);
    await logActivity(req, { action: "bank_account.create", entityType: "bank_account", entityId: account._id, newValue: account.toObject() });
    res.status(201).json(account);
  })
);

bankAccountsRouter.patch(
  "/:id",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(async (req, res) => {
    const data = bankAccountPayload.partial().parse(req.body);
    const oldAccount = await BankAccount.findById(req.params.id).lean();
    const account = await BankAccount.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!account) return res.status(404).json({ message: "Bank account not found" });
    await logActivity(req, { action: "bank_account.update", entityType: "bank_account", entityId: account._id, oldValue: oldAccount, newValue: account.toObject() });
    res.json(account);
  })
);

bankAccountsRouter.delete(
  "/:id",
  requireRole("super_admin", "admin", "accountant"),
  asyncHandler(async (req, res) => {
    const oldAccount = await BankAccount.findById(req.params.id).lean();
    if (!oldAccount) return res.status(404).json({ message: "Bank account not found" });
    const label = accountLabel(oldAccount);
    const labelMatch = { $in: [label, oldAccount.bankName, oldAccount.accountNumber] };
    const [earning, expense, transfer, voucher, bankRecord, statement, payroll] = await Promise.all([
      Earning.exists({ bankAccount: labelMatch }), Expense.exists({ bankAccount: labelMatch }),
      Transfer.exists({ bankAccount: labelMatch }), Voucher.exists({ bankAccount: labelMatch }),
      OperationalRecord.exists({ module: "bank", $or: [{ title: labelMatch }, { "fields.bankName": oldAccount.bankName }, { "fields.accountNumber": oldAccount.accountNumber }] }),
      BankStatementEntry.exists({ bankAccount: oldAccount._id }), Payroll.exists({ $or: [{ bankAccountId: oldAccount._id }, { bankAccount: labelMatch }] })
    ]);
    if ([earning, expense, transfer, voucher, bankRecord, statement, payroll].some(Boolean)) {
      return res.status(409).json({ message: "This bank account has transaction history and cannot be deleted. You can deactivate it instead." });
    }
    const account = await BankAccount.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!account) return res.status(404).json({ message: "Bank account not found" });
    await logActivity(req, { action: "bank_account.archive", entityType: "bank_account", entityId: account._id, oldValue: oldAccount, newValue: account.toObject() });
    res.json(account);
  })
);
