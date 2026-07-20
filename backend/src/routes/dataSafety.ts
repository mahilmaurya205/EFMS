import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const dataSafetyRouter = Router();
dataSafetyRouter.use(requireAuth, requireRole("super_admin"));

const allowedCollections = [
  "users", "roles", "expenses", "earnings", "vouchers", "invoices", "bankaccounts",
  "transfers", "operationalrecords", "masteroptions", "approvalrules", "journalentries",
  "cashentries", "numbersequences", "budgets", "bankstatemententries", "activitylogs"
] as const;

dataSafetyRouter.get("/backup", asyncHandler(async (req: AuthRequest, res) => {
  const database = mongoose.connection.db;
  if (!database) return res.status(503).json({ message: "Database unavailable" });
  const collections: Record<string, unknown[]> = {};
  for (const name of allowedCollections) collections[name] = await database.collection(name).find({}).toArray();
  const backup = { schemaVersion: 1, createdAt: new Date().toISOString(), collections };
  await logActivity(req, { action: "data.backup", entityType: "system", newValue: { collections: Object.keys(collections), counts: Object.fromEntries(Object.entries(collections).map(([key, rows]) => [key, rows.length])) } });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="efms-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(backup, null, 2));
}));

dataSafetyRouter.post("/restore", asyncHandler(async (req: AuthRequest, res) => {
  const data = z.object({
    confirmation: z.literal("RESTORE EFMS"),
    backup: z.object({ schemaVersion: z.literal(1), collections: z.record(z.array(z.record(z.unknown()))) })
  }).parse(req.body);
  const database = mongoose.connection.db;
  if (!database) return res.status(503).json({ message: "Database unavailable" });
  const restored: Record<string, number> = {};
  for (const name of allowedCollections) {
    const documents = data.backup.collections[name];
    if (!documents?.length || name === "activitylogs") continue;
    for (const document of documents) {
      if (!document._id) continue;
      await database.collection(name).replaceOne({ _id: document._id }, document, { upsert: true });
    }
    restored[name] = documents.length;
  }
  await logActivity(req, { action: "data.restore", entityType: "system", newValue: restored, reason: "Explicit RESTORE EFMS confirmation" });
  res.json({ restored });
}));
