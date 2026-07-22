import { Router } from "express";
import { z } from "zod";
import { requireAction, requireAuth, requirePermission, requireRole, type AuthRequest } from "../middleware/auth.js";
import { Expense } from "../models/Expense.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";
import { postExpenseToLedger } from "../services/accounting.js";

export const expensesRouter = Router();

expensesRouter.use(requireAuth, requirePermission("expenses"));

const expenseSchema = z.object({
  category: z.string().min(2),
  purpose: z.string().min(3),
  amount: z.number().positive(),
  vendor: z.string().optional(),
  expectedDate: z.string(),
  remarks: z.string().optional(),
  paidFrom: z.enum(["office", "employee"]).default("office"),
  spentByEmployeeId: z.string().optional(),
  spentByEmployeeName: z.string().optional(),
  paymentMode: z.enum(["cash", "cheque", "upi", "bank", "card", "other"]).default("cash"),
  bankAccount: z.string().optional(),
  proofFileName: z.string().trim().max(180).regex(/^[^\u0000-\u001f<>:"/\\|?*]+$/).optional(),
  proofData: z.string().max(2_800_000).regex(/^data:(image\/(png|jpeg|webp|avif|gif)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/).optional(),
  paidByEmployee: z.boolean().default(false)
});

expensesRouter.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const filter = req.user?.role === "employee" ? { employeeId: req.user.id, status: { $ne: "archived" } } : { status: { $ne: "archived" } };
    const expenses = await Expense.find(filter).populate("employeeId", "name email role").sort({ createdAt: -1 }).lean();
    res.json(expenses);
  })
);

expensesRouter.post(
  "/",
  requireAction("expenses.create"),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = expenseSchema.parse(req.body);
    const expenseData = {
      ...data,
      spentByEmployeeId: data.paidFrom === "employee" && data.spentByEmployeeId ? data.spentByEmployeeId : undefined,
      spentByEmployeeName: data.paidFrom === "employee" ? data.spentByEmployeeName : "",
      bankAccount: data.paidFrom === "office" && data.paymentMode !== "cash" ? data.bankAccount : ""
    };
    const expense = await Expense.create({
      ...expenseData,
      employeeId: req.user!.id,
      expectedDate: new Date(data.expectedDate),
      paidByEmployee: data.paidFrom === "employee",
      status: "entered",
      approvalSteps: [],
      currentStep: 0
    });
    await logActivity(req, { action: "expense.create", entityType: "expense", entityId: expense._id, newValue: expense.toObject() });
    res.status(201).json(expense);
  })
);

expensesRouter.patch(
  "/:id",
  requireAction("expenses.edit"),
  asyncHandler(async (req, res) => {
    const data = expenseSchema.partial().parse(req.body);
    const oldExpense = await Expense.findById(req.params.id).lean();
    const expenseData = {
      ...data,
      spentByEmployeeId: data.paidFrom === "employee" && data.spentByEmployeeId ? data.spentByEmployeeId : undefined,
      spentByEmployeeName: data.paidFrom === "employee" ? data.spentByEmployeeName : "",
      bankAccount: data.paidFrom === "office" && data.paymentMode && data.paymentMode !== "cash" ? data.bankAccount : ""
    };
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { ...expenseData, paidByEmployee: data.paidFrom ? data.paidFrom === "employee" : data.paidByEmployee, status: "entered" },
      { new: true }
    );
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    await logActivity(req, { action: "expense.update", entityType: "expense", entityId: expense._id, oldValue: oldExpense, newValue: expense.toObject() });
    res.json(expense);
  })
);

expensesRouter.delete(
  "/:id",
  requireAction("expenses.archive"),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    await logActivity(req, { action: "expense.archive", entityType: "expense", entityId: expense._id, newValue: expense.toObject() });
    res.json(expense);
  })
);

expensesRouter.patch(
  "/:id/approve",
  asyncHandler(async (req: AuthRequest, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    if (expense.status !== "pending_approval") return res.status(400).json({ message: "Expense is not pending approval" });

    const step = expense.approvalSteps[expense.currentStep];
    if (!step) return res.status(400).json({ message: "No pending approval step" });
    if (!["super_admin", "admin"].includes(req.user!.role) && step.role !== req.user!.role) {
      return res.status(403).json({ message: `Current step requires ${step.role}` });
    }

    step.status = "approved";
    step.approverId = req.user!.id as never;
    step.actedAt = new Date();
    expense.currentStep += 1;
    expense.status = expense.currentStep >= expense.approvalSteps.length ? "approved" : "pending_approval";
    await expense.save();
    await logActivity(req, { action: "expense.approve", entityType: "expense", entityId: expense._id, newValue: expense.toObject() });
    res.json(expense);
  })
);

expensesRouter.patch(
  "/:id/reject",
  asyncHandler(async (req: AuthRequest, res) => {
    const { reason } = z.object({ reason: z.string().min(10) }).parse(req.body);
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    const step = expense.approvalSteps[expense.currentStep];
    if (step) {
      step.status = "rejected";
      step.approverId = req.user!.id as never;
      step.comment = reason;
      step.actedAt = new Date();
    }
    expense.status = "rejected";
    expense.rejectionReason = reason;
    await expense.save();
    await logActivity(req, { action: "expense.reject", entityType: "expense", entityId: expense._id, reason });
    res.json(expense);
  })
);

expensesRouter.patch(
  "/:id/verify",
  asyncHandler(async (req: AuthRequest, res) => {
    if (!["super_admin", "admin", "accountant"].includes(req.user!.role)) return res.status(403).json({ message: "Accountant access required" });
    const expense = await Expense.findById(req.params.id).populate("employeeId", "name");
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    if (expense.status !== "approved") return res.status(400).json({ message: "Expense must be approved before posting" });

    const employee = expense.employeeId as unknown as { name?: string };
    const { voucher, journalEntry } = await postExpenseToLedger({
      expenseId: String(expense._id),
      amount: expense.amount,
      purpose: expense.purpose,
      paidByEmployee: expense.paidByEmployee,
      userId: req.user!.id,
      employeeName: employee.name
    });
    expense.status = "posted";
    expense.voucherId = voucher._id as never;
    expense.journalEntryId = journalEntry._id as never;
    await expense.save();
    await logActivity(req, { action: "expense.post", entityType: "expense", entityId: expense._id, newValue: { voucherId: voucher._id, journalEntryId: journalEntry._id } });
    res.json(expense);
  })
);
