import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApprovalRule } from "../models/ApprovalRule.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const approvalRulesRouter = Router();

approvalRulesRouter.use(requireAuth);

approvalRulesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rules = await ApprovalRule.find({ isActive: true }).sort({ minAmount: 1 }).lean();
    res.json(rules);
  })
);

approvalRulesRouter.post(
  "/",
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(2),
        appliesTo: z.enum(["expense", "refund", "purchase"]),
        minAmount: z.number().min(0),
        maxAmount: z.number().optional(),
        approverRoles: z.array(z.string()).min(1)
      })
      .parse(req.body);
    const rule = await ApprovalRule.create(data);
    res.status(201).json(rule);
  })
);
