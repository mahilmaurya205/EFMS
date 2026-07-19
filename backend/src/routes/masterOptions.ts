import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { MasterOption } from "../models/MasterOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const masterOptionsRouter = Router();

masterOptionsRouter.use(requireAuth);

const typeSchema = z.enum(["expense_category", "earning_source", "project"]);
const payloadSchema = z.object({
  name: z.string().min(2)
});

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
  requireRole("super_admin", "admin"),
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
  requireRole("super_admin", "admin"),
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
  requireRole("super_admin", "admin"),
  asyncHandler(async (req, res) => {
    typeSchema.parse(req.params.type);
    const option = await MasterOption.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!option) return res.status(404).json({ message: "Option not found" });
    await logActivity(req, { action: `${option.type}.archive`, entityType: "master_option", entityId: option._id });
    res.json(option);
  })
);
