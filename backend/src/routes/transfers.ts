import { Router } from "express";
import { z } from "zod";
import { requireAction, requireAuth, requirePermission } from "../middleware/auth.js";
import { Transfer } from "../models/Transfer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const transfersRouter = Router();

transfersRouter.use(requireAuth, requirePermission("transfers"));

const transferPayload = z.object({
  type: z.enum(["cash_to_bank", "bank_to_cash"]),
  amount: z.number().positive(),
  bankAccount: z.string().min(2),
  referenceNo: z.string().optional(),
  remarks: z.string().optional(),
  transferDate: z.string()
});

transfersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const transfers = await Transfer.find({ status: { $ne: "archived" } }).sort({ transferDate: -1, createdAt: -1 }).lean();
    res.json(transfers);
  })
);

transfersRouter.post(
  "/",
  requireAction("transfers.create"),
  asyncHandler(async (req, res) => {
    const data = transferPayload.parse(req.body);
    const transfer = await Transfer.create({ ...data, transferDate: new Date(data.transferDate) });
    await logActivity(req, { action: "transfer.create", entityType: "transfer", entityId: transfer._id, newValue: transfer.toObject() });
    res.status(201).json(transfer);
  })
);

transfersRouter.patch(
  "/:id",
  requireAction("transfers.edit"),
  asyncHandler(async (req, res) => {
    const data = transferPayload.partial().parse(req.body);
    const oldTransfer = await Transfer.findById(req.params.id).lean();
    const transfer = await Transfer.findByIdAndUpdate(req.params.id, { ...data, transferDate: data.transferDate ? new Date(data.transferDate) : undefined }, { new: true });
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    await logActivity(req, { action: "transfer.update", entityType: "transfer", entityId: transfer._id, oldValue: oldTransfer, newValue: transfer.toObject() });
    res.json(transfer);
  })
);

transfersRouter.delete(
  "/:id",
  requireAction("transfers.archive"),
  asyncHandler(async (req, res) => {
    const oldTransfer = await Transfer.findById(req.params.id).lean();
    const transfer = await Transfer.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    await logActivity(req, { action: "transfer.archive", entityType: "transfer", entityId: transfer._id, oldValue: oldTransfer, newValue: transfer.toObject() });
    res.json(transfer);
  })
);
