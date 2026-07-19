import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { OperationalRecord } from "../models/OperationalRecord.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

const moduleSchema = z.enum(["cash", "bank", "refund", "salary", "document", "report", "setting"]);
const payloadSchema = z.object({
  title: z.string().min(1),
  amount: z.number().optional(),
  status: z.string().optional(),
  remarks: z.string().optional(),
  fields: z.record(z.unknown()).optional()
});

recordsRouter.get(
  "/:module",
  asyncHandler(async (req, res) => {
    const module = moduleSchema.parse(req.params.module);
    const records = await OperationalRecord.find({ module }).sort({ createdAt: -1 }).lean();
    res.json(records);
  })
);

recordsRouter.post(
  "/:module",
  asyncHandler(async (req: AuthRequest, res) => {
    const module = moduleSchema.parse(req.params.module);
    const data = payloadSchema.parse(req.body);
    const record = await OperationalRecord.create({ ...data, module, createdBy: req.user?.id });
    await logActivity(req, { action: `${module}.create`, entityType: module, entityId: record._id, newValue: record.toObject() });
    res.status(201).json(record);
  })
);

recordsRouter.patch(
  "/:module/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const module = moduleSchema.parse(req.params.module);
    const data = payloadSchema.partial().parse(req.body);
    const record = await OperationalRecord.findOneAndUpdate({ _id: req.params.id, module }, data, { new: true });
    if (!record) return res.status(404).json({ message: "Record not found" });
    await logActivity(req, { action: `${module}.update`, entityType: module, entityId: record._id, newValue: record.toObject() });
    res.json(record);
  })
);

recordsRouter.delete(
  "/:module/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const module = moduleSchema.parse(req.params.module);
    const record = await OperationalRecord.findOneAndUpdate({ _id: req.params.id, module }, { status: "archived" }, { new: true });
    if (!record) return res.status(404).json({ message: "Record not found" });
    await logActivity(req, { action: `${module}.archive`, entityType: module, entityId: record._id });
    res.json(record);
  })
);
