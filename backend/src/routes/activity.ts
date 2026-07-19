import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get(
  "/",
  requireRole("super_admin"),
  asyncHandler(async (_req, res) => {
    const logs = await ActivityLog.find().populate("userId", "name email role").sort({ createdAt: -1 }).limit(500).lean();
    res.json(logs);
  })
);
