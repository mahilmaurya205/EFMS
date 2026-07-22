import { Router } from "express";
import { z } from "zod";
import { Invoice } from "../models/Invoice.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { nextDocumentNumber } from "../utils/numbers.js";
import { generateInvoicePdf } from "../services/pdf.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth, requirePermission("vouchers"));

const invoicePayload = z.object({
  customer: z.string().min(2).optional(),
  customerGst: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(["draft", "issued", "paid", "cancelled"]).optional()
});

invoicesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
    res.json(invoices);
  })
);

invoicesRouter.get("/:id/pdf", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const buffer = await generateInvoicePdf(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(buffer);
}));

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        type: z.enum(["quotation", "proforma", "tax_invoice", "receipt", "credit_note", "debit_note"]),
        customer: z.string().min(2),
        customerGst: z.string().optional(),
        remarks: z.string().optional(),
        lines: z.array(z.object({ description: z.string(), quantity: z.number().positive(), unitPrice: z.number().min(0), gstRate: z.number().min(0).default(18) })).min(1)
      })
      .parse(req.body);
    const subtotal = data.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const gstAmount = data.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (line.gstRate / 100), 0);
    const invoice = await Invoice.create({
      ...data,
      invoiceNumber: await nextDocumentNumber(data.type),
      subtotal,
      gstAmount,
      totalAmount: subtotal + gstAmount
    });
    res.status(201).json(invoice);
  })
);

invoicesRouter.patch(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const data = invoicePayload.parse(req.body);
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  })
);

invoicesRouter.delete(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: "cancelled" }, { new: true });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  })
);
