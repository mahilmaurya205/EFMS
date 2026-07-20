import { Router } from "express";
import { z } from "zod";
import { Budget } from "../models/Budget.js";
import { Expense } from "../models/Expense.js";
import { requireAuth, requirePermission, requireRole, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth, requirePermission("budgets"));

const payload = z.object({
  name: z.string().min(2),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().optional().default(""),
  department: z.string().optional().default(""),
  limit: z.number().positive()
});

async function withSpend(budgets: Array<Record<string, any>>) {
  return Promise.all(budgets.map(async (budget) => {
    const start = new Date(`${budget.month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const filter: Record<string, unknown> = { createdAt: { $gte: start, $lt: end }, status: { $ne: "archived" } };
    if (budget.category) filter.category = budget.category;
    if (budget.department) {
      const ids = await (await import("../models/User.js")).User.find({ department: budget.department }).distinct("_id");
      filter.employeeId = { $in: ids };
    }
    const result = await Expense.aggregate([{ $match: filter }, { $group: { _id: null, spent: { $sum: "$amount" } } }]);
    const spent = result[0]?.spent ?? 0;
    return { ...budget, spent, remaining: budget.limit - spent, utilization: budget.limit ? Math.round((spent / budget.limit) * 1000) / 10 : 0, alert: spent >= budget.limit ? "exceeded" : spent >= budget.limit * 0.8 ? "warning" : "ok" };
  }));
}

budgetsRouter.get("/", asyncHandler(async (_req, res) => res.json(await withSpend(await Budget.find({ isArchived: false }).sort({ month: -1 }).lean()))));
budgetsRouter.post("/", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const budget = await Budget.create({ ...payload.parse(req.body), createdBy: req.user!.id });
  await logActivity(req, { action: "budget.create", entityType: "budget", entityId: budget._id, newValue: budget.toObject() });
  res.status(201).json((await withSpend([budget.toObject()]))[0]);
}));
budgetsRouter.patch("/:id", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const oldValue = await Budget.findById(req.params.id).lean();
  const budget = await Budget.findByIdAndUpdate(req.params.id, payload.partial().parse(req.body), { new: true });
  if (!budget) return res.status(404).json({ message: "Budget not found" });
  await logActivity(req, { action: "budget.update", entityType: "budget", entityId: budget._id, oldValue, newValue: budget.toObject() });
  res.json((await withSpend([budget.toObject()]))[0]);
}));
budgetsRouter.delete("/:id", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const budget = await Budget.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
  if (!budget) return res.status(404).json({ message: "Budget not found" });
  await logActivity(req, { action: "budget.archive", entityType: "budget", entityId: budget._id, newValue: budget.toObject() });
  res.json(budget);
}));
