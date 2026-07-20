import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { BankStatementEntry } from "../models/BankStatementEntry.js";
import { requireAuth, requirePermission, requireRole, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const reconciliationRouter = Router();
reconciliationRouter.use(requireAuth, requirePermission("reconciliation"));

const entrySchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  reference: z.string().optional().default(""),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  balance: z.coerce.number().optional()
}).refine((item) => item.debit > 0 || item.credit > 0, "Debit or credit is required");

reconciliationRouter.get("/", asyncHandler(async (req, res) => {
  const bankAccount = z.string().optional().parse(req.query.bankAccount);
  const filter: Record<string, unknown> = { isArchived: false };
  if (bankAccount) filter.bankAccount = bankAccount;
  res.json(await BankStatementEntry.find(filter).populate("bankAccount", "bankName accountNumber").sort({ transactionDate: -1 }).lean());
}));

reconciliationRouter.post("/import", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const data = z.object({ bankAccount: z.string().min(1), entries: z.array(entrySchema).min(1).max(5000) }).parse(req.body);
  const importBatch = randomUUID();
  let duplicates = 0;
  const inserted = [];
  for (const entry of data.entries) {
    const transactionDate = new Date(entry.date);
    if (Number.isNaN(transactionDate.valueOf())) continue;
    const fingerprint = createHash("sha256").update([data.bankAccount, transactionDate.toISOString().slice(0, 10), entry.description, entry.reference, entry.debit, entry.credit, entry.balance ?? ""].join("|")).digest("hex");
    try {
      inserted.push(await BankStatementEntry.create({ ...entry, transactionDate, bankAccount: data.bankAccount, importBatch, fingerprint, createdBy: req.user!.id }));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) duplicates += 1;
      else throw error;
    }
  }
  await logActivity(req, { action: "reconciliation.import", entityType: "bank_statement", newValue: { bankAccount: data.bankAccount, imported: inserted.length, duplicates, importBatch } });
  res.status(201).json({ imported: inserted.length, duplicates, importBatch });
}));

reconciliationRouter.patch("/:id/match", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const data = z.object({ matchType: z.enum(["earning", "expense", "voucher", "transfer", "manual"]), matchedRecordId: z.string().min(1) }).parse(req.body);
  const entry = await BankStatementEntry.findByIdAndUpdate(req.params.id, { ...data, matchedAt: new Date() }, { new: true });
  if (!entry) return res.status(404).json({ message: "Statement entry not found" });
  await logActivity(req, { action: "reconciliation.match", entityType: "bank_statement", entityId: entry._id, newValue: entry.toObject() });
  res.json(entry);
}));

reconciliationRouter.delete("/:id/match", requireRole("super_admin"), asyncHandler(async (req: AuthRequest, res) => {
  const entry = await BankStatementEntry.findByIdAndUpdate(req.params.id, { matchType: "", matchedRecordId: "", $unset: { matchedAt: 1 } }, { new: true });
  if (!entry) return res.status(404).json({ message: "Statement entry not found" });
  await logActivity(req, { action: "reconciliation.unmatch", entityType: "bank_statement", entityId: entry._id });
  res.json(entry);
}));
