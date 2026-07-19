import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Role } from "../models/Role.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth);
rolesRouter.use(requireRole("super_admin"));

const rolePayload = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  sidebarPermissions: z.array(z.string()).optional(),
  dashboardPermissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

function normalizeRole(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

rolesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const roles = await Role.find({ isArchived: false }).sort({ createdAt: -1 }).lean();
    res.json(roles);
  })
);

rolesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = rolePayload.parse(req.body);
    const name = normalizeRole(data.name);
    if (["super_admin", "employee"].includes(name)) return res.status(400).json({ message: "This role is fixed and cannot be created here" });
    const role = await Role.create({ ...data, name });
    await logActivity(req, { action: "role.create", entityType: "role", entityId: role._id, newValue: role.toObject() });
    res.status(201).json(role);
  })
);

rolesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = rolePayload.partial().parse(req.body);
    const update = { ...data, name: data.name ? normalizeRole(data.name) : undefined };
    if (update.name && ["super_admin", "employee"].includes(update.name)) return res.status(400).json({ message: "This role name is reserved" });
    const oldRole = await Role.findById(req.params.id).lean();
    const role = await Role.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!role) return res.status(404).json({ message: "Role not found" });
    await logActivity(req, { action: "role.update", entityType: "role", entityId: role._id, oldValue: oldRole, newValue: role.toObject() });
    res.json(role);
  })
);

rolesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const oldRole = await Role.findById(req.params.id).lean();
    const role = await Role.findByIdAndUpdate(req.params.id, { isArchived: true, isActive: false }, { new: true });
    if (!role) return res.status(404).json({ message: "Role not found" });
    await logActivity(req, { action: "role.archive", entityType: "role", entityId: role._id, oldValue: oldRole, newValue: role.toObject() });
    res.json(role);
  })
);
