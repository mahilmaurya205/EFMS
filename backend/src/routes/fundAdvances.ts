import { Router } from "express";
import { z } from "zod";
import { requireAction, requireAuth, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { FundAdvance } from "../models/FundAdvance.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";
import { nextDocumentNumber } from "../utils/numbers.js";

export const fundAdvancesRouter = Router();
fundAdvancesRouter.use(requireAuth, requirePermission("advances"));

const fileName = z.string().trim().max(180).regex(/^[^\u0000-\u001f<>:"/\\|?*]+$/).optional();
const proofData = z.string().max(2_800_000).regex(/^data:(image\/(png|jpeg|webp|avif|gif)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/).optional();
const advancePayload = z.object({
  recipientType: z.enum(["employee", "other"]),
  employeeId: z.string().optional(),
  recipientName: z.string().min(2),
  recipientPhone: z.string().optional(),
  purpose: z.string().min(3),
  amount: z.number().positive(),
  source: z.enum(["cash", "bank"]),
  bankAccount: z.string().optional(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
  referenceNo: z.string().optional(),
  remarks: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.recipientType === "employee" && !data.employeeId) ctx.addIssue({ code: "custom", path: ["employeeId"], message: "Select an employee" });
  if (data.source === "bank" && !data.bankAccount) ctx.addIssue({ code: "custom", path: ["bankAccount"], message: "Select a bank account" });
});
const expensePayload = z.object({
  expenseDate: z.string(), category: z.string().min(2), purpose: z.string().min(3), vendor: z.string().optional(),
  amount: z.number().positive(), paymentMode: z.enum(["cash", "upi", "bank", "card", "other"]).default("cash"),
  referenceNo: z.string().optional(), remarks: z.string().optional(), proofFileName: fileName, proofData
});
const refundPayload = z.object({
  refundDate: z.string(), amount: z.number().positive(), mode: z.enum(["cash", "bank"]),
  bankAccount: z.string().optional(), referenceNo: z.string().optional(), remarks: z.string().optional()
});

function totals(advance: { amount: number; expenses: Array<{ amount: number }>; refunds: Array<{ amount: number }> }) {
  const spent = advance.expenses.reduce((sum, item) => sum + item.amount, 0);
  const refunded = advance.refunds.reduce((sum, item) => sum + item.amount, 0);
  return { spent, refunded, outstanding: Math.max(advance.amount - spent - refunded, 0), excess: Math.max(spent + refunded - advance.amount, 0) };
}

fundAdvancesRouter.get("/", asyncHandler(async (req: AuthRequest, res) => {
  const filter = req.user?.employeeProfile ? { employeeId: req.user.id, status: { $ne: "archived" } } : { status: { $ne: "archived" } };
  const rows = await FundAdvance.find(filter).populate("employeeId", "name email employeeCode").sort({ issueDate: -1, createdAt: -1 }).lean();
  res.json(rows.map((row) => ({ ...row, ...totals(row) })));
}));

fundAdvancesRouter.post("/", requireAction("advances.create"), asyncHandler(async (req: AuthRequest, res) => {
  const data = advancePayload.parse(req.body);
  let recipientName = data.recipientName.trim();
  if (data.recipientType === "employee") {
    const employee = await User.findById(data.employeeId).lean();
    if (!employee) return res.status(400).json({ message: "Employee not found" });
    recipientName = employee.name;
  }
  const advance = await FundAdvance.create({
    ...data, recipientName, employeeId: data.recipientType === "employee" ? data.employeeId : undefined,
    bankAccount: data.source === "bank" ? data.bankAccount : "", issueDate: new Date(data.issueDate),
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined, advanceNumber: await nextDocumentNumber("advance"), createdBy: req.user!.id
  });
  await logActivity(req, { action: "advance.create", entityType: "fund_advance", entityId: advance._id, newValue: advance.toObject() });
  res.status(201).json({ ...advance.toObject(), ...totals(advance) });
}));

fundAdvancesRouter.post("/:id/expenses", requireAction("advances.add_expense"), asyncHandler(async (req: AuthRequest, res) => {
  const data = expensePayload.parse(req.body);
  const advance = await FundAdvance.findById(req.params.id);
  if (!advance || advance.status === "archived") return res.status(404).json({ message: "Advance not found" });
  if (advance.status === "settled") return res.status(400).json({ message: "Settled advance cannot be changed" });
  advance.expenses.push({ ...data, expenseDate: new Date(data.expenseDate), enteredBy: req.user!.id } as never);
  advance.status = "open";
  await advance.save();
  await logActivity(req, { action: "advance.expense.add", entityType: "fund_advance", entityId: advance._id, newValue: data });
  res.status(201).json({ ...advance.toObject(), ...totals(advance) });
}));

fundAdvancesRouter.post("/:id/refunds", requireAction("advances.refund"), asyncHandler(async (req: AuthRequest, res) => {
  const data = refundPayload.parse(req.body);
  const advance = await FundAdvance.findById(req.params.id);
  if (!advance || advance.status === "archived") return res.status(404).json({ message: "Advance not found" });
  if (advance.status === "settled") return res.status(400).json({ message: "Settled advance cannot be changed" });
  const current = totals(advance);
  if (data.amount > current.outstanding) return res.status(400).json({ message: `Refund cannot exceed outstanding amount (${current.outstanding})` });
  if (data.mode === "bank" && !data.bankAccount) return res.status(400).json({ message: "Select bank account for bank refund" });
  advance.refunds.push({ ...data, refundDate: new Date(data.refundDate), bankAccount: data.mode === "bank" ? data.bankAccount : "", receivedBy: req.user!.id } as never);
  const updated = totals(advance);
  if (updated.outstanding === 0 && updated.excess === 0) advance.status = "settled";
  await advance.save();
  await logActivity(req, { action: "advance.refund.add", entityType: "fund_advance", entityId: advance._id, newValue: data });
  res.status(201).json({ ...advance.toObject(), ...updated });
}));

fundAdvancesRouter.patch("/:id/settle", requireAction("advances.settle"), asyncHandler(async (req, res) => {
  const advance = await FundAdvance.findById(req.params.id);
  if (!advance || advance.status === "archived") return res.status(404).json({ message: "Advance not found" });
  const current = totals(advance);
  if (current.outstanding > 0 || current.excess > 0) return res.status(400).json({ message: "Advance can be settled only when balance and excess are zero" });
  advance.status = "settled"; await advance.save();
  await logActivity(req, { action: "advance.settle", entityType: "fund_advance", entityId: advance._id, newValue: { status: "settled" } });
  res.json({ ...advance.toObject(), ...current });
}));

fundAdvancesRouter.delete("/:id", requireAction("advances.archive"), asyncHandler(async (req, res) => {
  const advance = await FundAdvance.findById(req.params.id);
  if (!advance) return res.status(404).json({ message: "Advance not found" });
  if (advance.expenses.length || advance.refunds.length) return res.status(400).json({ message: "Advance with expense/refund history cannot be archived" });
  advance.status = "archived"; await advance.save();
  await logActivity(req, { action: "advance.archive", entityType: "fund_advance", entityId: advance._id });
  res.json(advance);
}));
