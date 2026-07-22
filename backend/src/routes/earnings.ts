import { Router } from "express";
import { z } from "zod";
import { requireAction, requireAuth, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Earning } from "../models/Earning.js";
import { logActivity } from "../services/activity.js";

export const earningsRouter = Router();

earningsRouter.use(requireAuth, requirePermission("earnings"));

const earningPayload = z.object({
  source: z.string().min(2).optional(),
  project: z.string().optional(),
  customer: z.string().min(2).optional(),
  paymentMode: z.enum(["cash", "bank", "upi", "cheque", "other"]).optional(),
  bankAccount: z.string().optional(),
  referenceNo: z.string().optional(),
  remarks: z.string().optional(),
  gstApplicable: z.boolean().optional(),
  gstRate: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional()
});

earningsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const earnings = await Earning.find().sort({ createdAt: -1 }).lean();
    res.json(earnings);
  })
);

earningsRouter.post(
  "/",
  requireAction("earnings.create"),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        source: z.string().min(2),
        project: z.string().optional(),
        customer: z.string().min(2),
        paymentMode: z.enum(["cash", "bank", "upi", "cheque", "other"]),
        bankAccount: z.string().optional(),
        referenceNo: z.string().optional(),
        remarks: z.string().optional(),
        gstApplicable: z.boolean().default(true),
        gstRate: z.number().min(0).default(18),
        amount: z.number().min(0).optional(),
        paidAmount: z.number().min(0).default(0)
      })
      .parse(req.body);

    const amount = data.amount ?? data.paidAmount;
    const gstAmount = 0;
    const total = amount;
    const remainingAmount = Math.max(total - data.paidAmount, 0);
    const status = remainingAmount === 0 ? "paid" : data.paidAmount > 0 ? "partial" : "pending";

    const earning = await Earning.create({
      ...data,
      amount,
      gstApplicable: false,
      gstRate: 0,
      gstAmount,
      remainingAmount,
      status
    });

    await logActivity(req, {
      action: "earning.create",
      entityType: "earning",
      entityId: earning._id,
      newValue: earning.toObject()
    });

    res.status(201).json(earning);
  })
);

earningsRouter.patch(
  "/:id",
  requireAction("earnings.edit"),
  asyncHandler(async (req, res) => {
    const data = earningPayload.parse(req.body);
    const earning = await Earning.findById(req.params.id);
    if (!earning) return res.status(404).json({ message: "Earning not found" });
    const oldValue = earning.toObject();

    Object.assign(earning, data);
    const amount = data.amount ?? data.paidAmount ?? earning.paidAmount;
    earning.amount = amount;
    earning.gstApplicable = false;
    earning.gstRate = 0;
    earning.gstAmount = 0;
    const total = amount;
    earning.remainingAmount = Math.max(total - earning.paidAmount, 0);
    earning.status = earning.remainingAmount === 0 ? "paid" : earning.paidAmount > 0 ? "partial" : "pending";
    await earning.save();

    await logActivity(req, { action: "earning.update", entityType: "earning", entityId: earning._id, oldValue, newValue: earning.toObject() });
    res.json(earning);
  })
);

earningsRouter.delete(
  "/:id",
  requireAction("earnings.archive"),
  asyncHandler(async (req, res) => {
    const earning = await Earning.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!earning) return res.status(404).json({ message: "Earning not found" });
    await logActivity(req, { action: "earning.archive", entityType: "earning", entityId: earning._id, newValue: earning.toObject() });
    res.json(earning);
  })
);
