import { Router } from "express";
import { Voucher } from "../models/Voucher.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";
import { nextDocumentNumber } from "../utils/numbers.js";
import { logActivity } from "../services/activity.js";
import type { AuthRequest } from "../middleware/auth.js";
import { generateVoucherPdf } from "../services/pdf.js";

export const vouchersRouter = Router();
vouchersRouter.use(requireAuth);

vouchersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const vouchers = await Voucher.find().populate("givenBy", "name").sort({ createdAt: -1 }).lean();
    res.json(vouchers);
  })
);

vouchersRouter.get("/:id/pdf", asyncHandler(async (req: AuthRequest, res) => {
  const voucher = await Voucher.findById(req.params.id).populate("givenBy", "name").lean();
  if (!voucher) return res.status(404).json({ message: "Voucher not found" });
  const buffer = await generateVoucherPdf(voucher);
  await logActivity(req, { action: "voucher.pdf_download", entityType: "voucher", entityId: voucher._id });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${voucher.voucherNumber}.pdf"`);
  res.send(buffer);
}));

const voucherPayload = z.object({
  type: z.enum(["payment", "receipt", "journal", "contra", "refund", "salary", "advance", "expense"]).default("payment"),
  amount: z.number().positive(),
  purpose: z.string().min(2),
  receiver: z.string().optional(),
  paymentMode: z.enum(["cash", "cheque", "upi", "bank", "card", "other"]).default("cash"),
  bankAccount: z.string().optional(),
  referenceNo: z.string().optional(),
  remarks: z.string().optional()
});

vouchersRouter.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const data = voucherPayload.parse(req.body);
    const voucher = await Voucher.create({
      ...data,
      voucherNumber: await nextDocumentNumber(data.type),
      givenBy: req.user!.id,
      status: "issued"
    });
    await logActivity(req, { action: "voucher.create", entityType: "voucher", entityId: voucher._id, newValue: voucher.toObject() });
    res.status(201).json(voucher);
  })
);

vouchersRouter.patch(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const data = voucherPayload.partial().parse(req.body);
    const oldVoucher = await Voucher.findById(req.params.id).lean();
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    await logActivity(req, { action: "voucher.update", entityType: "voucher", entityId: voucher._id, oldValue: oldVoucher, newValue: voucher.toObject() });
    res.json(voucher);
  })
);

vouchersRouter.delete(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const oldVoucher = await Voucher.findById(req.params.id).lean();
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, { status: "cancelled", cancelReason: "Cancelled by Super Admin" }, { new: true });
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    await logActivity(req, { action: "voucher.cancel", entityType: "voucher", entityId: voucher._id, oldValue: oldVoucher, newValue: voucher.toObject() });
    res.json(voucher);
  })
);
