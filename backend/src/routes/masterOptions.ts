import { Router } from "express";
import { z } from "zod";
import { requireAction, requireAuth, type AuthRequest } from "../middleware/auth.js";
import { MasterOption } from "../models/MasterOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const masterOptionsRouter = Router();

masterOptionsRouter.use(requireAuth);

const typeSchema = z.enum(["expense_category", "earning_source", "project"]);
const payloadSchema = z.object({
  name: z.string().min(2)
});

function requireOptionAction(req: AuthRequest, res: import("express").Response, next: import("express").NextFunction) {
  const type = typeSchema.safeParse(req.params.type);
  if (!type.success) return res.status(400).json({ message: "Invalid option type" });
  const action = type.data === "expense_category" ? "expenses.manage_categories" : type.data === "earning_source" ? "earnings.manage_sources" : "earnings.manage_projects";
  return requireAction(action)(req, res, next);
}

masterOptionsRouter.get(
  "/:type",
  asyncHandler(async (req, res) => {
    const type = typeSchema.parse(req.params.type);
    const options = await MasterOption.find({ type, isArchived: false }).sort({ name: 1 }).lean();
    res.json(options);
  })
);

masterOptionsRouter.post(
  "/:type",
  requireOptionAction,
  asyncHandler(async (req, res) => {
    const type = typeSchema.parse(req.params.type);
    const data = payloadSchema.parse(req.body);
    const option = await MasterOption.create({ type, name: data.name });
    await logActivity(req, { action: `${type}.create`, entityType: "master_option", entityId: option._id, newValue: option.toObject() });
    res.status(201).json(option);
  })
);

masterOptionsRouter.patch(
  "/:type/:id",
  requireOptionAction,
  asyncHandler(async (req, res) => {
    typeSchema.parse(req.params.type);
    const data = payloadSchema.parse(req.body);
    const option = await MasterOption.findByIdAndUpdate(req.params.id, { name: data.name }, { new: true });
    if (!option) return res.status(404).json({ message: "Option not found" });
    await logActivity(req, { action: `${option.type}.update`, entityType: "master_option", entityId: option._id, newValue: option.toObject() });
    res.json(option);
  })
);

masterOptionsRouter.delete(
  "/:type/:id",
  requireOptionAction,
  asyncHandler(async (req, res) => {
    typeSchema.parse(req.params.type);
    const option = await MasterOption.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!option) return res.status(404).json({ message: "Option not found" });
    await logActivity(req, { action: `${option.type}.archive`, entityType: "master_option", entityId: option._id });
    res.json(option);
  })
);
