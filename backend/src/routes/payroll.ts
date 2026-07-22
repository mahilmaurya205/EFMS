import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAction, requireAnyPermission, requireAuth, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Payroll } from "../models/Payroll.js";
import { User } from "../models/User.js";
import { Expense } from "../models/Expense.js";
import { BankAccount } from "../models/BankAccount.js";
import { CashEntry } from "../models/CashEntry.js";
import { Voucher } from "../models/Voucher.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { nextDocumentNumber } from "../utils/numbers.js";
import { logActivity } from "../services/activity.js";
import { generateSalarySlipPdf } from "../services/pdf.js";
import { Earning } from "../models/Earning.js";
import { Transfer } from "../models/Transfer.js";

export const payrollRouter = Router();
payrollRouter.use(requireAuth);

const createSchema = z.object({
  employeeId: z.string().min(1), salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  includeExpenses: z.boolean().default(false), paymentMode: z.enum(["cash", "bank"]),
  bankAccountId: z.string().optional(), referenceNo: z.string().trim().max(100).optional(),
  paymentDate: z.string(), remarks: z.string().trim().max(500).optional()
}).superRefine((value, ctx) => {
  if (value.paymentMode === "bank" && !value.bankAccountId) ctx.addIssue({ code: "custom", path: ["bankAccountId"], message: "Bank account is required" });
});

payrollRouter.get("/", requireAnyPermission("payroll", "statements"), asyncHandler(async (_req, res) => {
  res.json(await Payroll.find().populate("employeeId", "name email department designation").sort({ paymentDate: -1, createdAt: -1 }).lean());
}));

payrollRouter.get("/eligible-expenses/:employeeId", requirePermission("payroll"), asyncHandler(async (req, res) => {
  res.json(await Expense.find({ spentByEmployeeId: req.params.employeeId, paidFrom: "employee", payrollId: { $exists: false }, status: { $nin: ["archived", "rejected"] } }).select("purpose category amount expectedDate createdAt").sort({ createdAt: 1 }).lean());
}));

payrollRouter.post("/", requirePermission("payroll"), requireAction("payroll.create"), asyncHandler(async (req: AuthRequest, res) => {
  const data = createSchema.parse(req.body);
  const employee = await User.findOne({ _id: data.employeeId, role: "employee", isActive: { $ne: false } }).lean();
  if (!employee) return res.status(404).json({ message: "Active employee not found" });
  if (await Payroll.exists({ employeeId: employee._id, salaryMonth: data.salaryMonth, status: "paid" })) return res.status(409).json({ message: "Salary is already paid for this employee and month" });
  const expenses = data.includeExpenses ? await Expense.find({ spentByEmployeeId: employee._id, paidFrom: "employee", payrollId: { $exists: false }, status: { $nin: ["archived", "rejected"] } }).lean() : [];
  const reimbursementAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const basicSalary = Number(employee.basicSalary || 0);
  const totalPaid = basicSalary + reimbursementAmount;
  if (totalPaid <= 0) return res.status(400).json({ message: "Salary and reimbursement total must be greater than zero" });
  const bank = data.paymentMode === "bank" ? await BankAccount.findOne({ _id: data.bankAccountId, isArchived: false, isActive: { $ne: false } }) : null;
  if (data.paymentMode === "bank" && (!bank || bank.currentBalance < totalPaid)) return res.status(400).json({ message: "Selected bank account has insufficient balance" });
  if (data.paymentMode === "cash") {
    const [cashEntries, cashEarnings, cashExpenses, cashVouchers, cashToBank, bankToCash] = await Promise.all([
      CashEntry.find().lean(),
      Earning.aggregate([{ $match: { status: { $ne: "archived" }, paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Expense.aggregate([{ $match: { status: { $ne: "archived" }, paidFrom: "office", paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Voucher.aggregate([{ $match: { status: "issued", type: { $ne: "receipt" }, sourceType: { $ne: "payroll" }, paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transfer.aggregate([{ $match: { status: { $ne: "archived" }, type: "cash_to_bank" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transfer.aggregate([{ $match: { status: { $ne: "archived" }, type: "bank_to_cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    ]);
    const cashBook = cashEntries.reduce((sum, entry) => ["received", "withdrawn"].includes(entry.type) ? sum + entry.amount : ["spent", "deposit"].includes(entry.type) ? sum - entry.amount : sum, 0);
    const cashAvailable = cashBook + (cashEarnings[0]?.total ?? 0) - (cashExpenses[0]?.total ?? 0) - (cashVouchers[0]?.total ?? 0) - (cashToBank[0]?.total ?? 0) + (bankToCash[0]?.total ?? 0);
    if (cashAvailable < totalPaid) return res.status(400).json({ message: "Cash in hand is insufficient for this payroll" });
  }

  const session = await mongoose.startSession();
  let payroll: any;
  try {
    await session.withTransaction(async () => {
      const payrollNumber = await nextDocumentNumber("salary");
      [payroll] = await Payroll.create([{ payrollNumber, employeeId: employee._id, salaryMonth: data.salaryMonth, basicSalary, reimbursementAmount, totalPaid, includeExpenses: data.includeExpenses, expenseIds: expenses.map((item) => item._id), paymentMode: data.paymentMode, bankAccountId: bank?._id, bankAccount: bank ? `${bank.bankName} - ${bank.accountNumber}` : "", referenceNo: data.referenceNo, paymentDate: new Date(data.paymentDate), remarks: data.remarks, createdBy: req.user!.id }], { session });
      if (expenses.length) {
        const result = await Expense.updateMany({ _id: { $in: expenses.map((item) => item._id) }, payrollId: { $exists: false } }, { $set: { payrollId: payroll._id, reimbursedAt: new Date(), status: "closed" } }, { session });
        if (result.modifiedCount !== expenses.length) throw new Error("One or more expenses were already reimbursed");
      }
      if (bank) {
        const debit = await BankAccount.updateOne({ _id: bank._id, currentBalance: { $gte: totalPaid } }, { $inc: { currentBalance: -totalPaid } }, { session });
        if (debit.modifiedCount !== 1) throw new Error("Selected bank account has insufficient balance");
      } else await CashEntry.create([{ businessDate: new Date(data.paymentDate), type: "spent", amount: totalPaid, purpose: `Payroll ${payrollNumber} - ${employee.name}`, doneBy: req.user!.id }], { session });
      const [voucher] = await Voucher.create([{ type: "salary", voucherNumber: payrollNumber, amount: totalPaid, purpose: `Salary ${data.salaryMonth}${data.includeExpenses ? " with expense reimbursement" : ""}`, receiver: employee.name, paymentMode: data.paymentMode, bankAccount: bank ? `${bank.bankName} - ${bank.accountNumber}` : "", referenceNo: data.referenceNo, remarks: data.remarks, givenBy: req.user!.id, sourceType: "payroll", sourceId: payroll._id }], { session });
      await JournalEntry.create([{ voucherId: voucher._id, description: `Payroll ${payrollNumber}`, createdBy: req.user!.id, lines: [{ account: "Salary Expense", debit: basicSalary, credit: 0 }, ...(reimbursementAmount ? [{ account: "Employee Payable", debit: reimbursementAmount, credit: 0 }] : []), { account: data.paymentMode === "cash" ? "Cash" : "Bank", debit: 0, credit: totalPaid }] }], { session });
      payroll.voucherId = voucher._id; await payroll.save({ session });
    });
  } finally { await session.endSession(); }
  await logActivity(req, { action: "payroll.create", entityType: "payroll", entityId: payroll._id, newValue: { payrollNumber: payroll.payrollNumber, employee: employee.name, totalPaid } });
  res.status(201).json(await Payroll.findById(payroll._id).populate("employeeId", "name email department designation").lean());
}));

payrollRouter.get("/:id/pdf", requirePermission("payroll"), asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id).populate("employeeId", "name email department designation").lean();
  if (!payroll) return res.status(404).json({ message: "Payroll not found" });
  const pdf = await generateSalarySlipPdf(payroll as any);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${payroll.payrollNumber}.pdf"`);
  res.send(pdf);
}));
