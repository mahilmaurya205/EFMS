import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Role } from "../models/Role.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isActive) return res.status(401).json({ message: "User is inactive" });
    if (user.role === "employee") return res.status(403).json({ message: "Employee login is disabled" });
    let permissions = { sidebar: [] as string[], dashboard: [] as string[] };
    if (user.role !== "super_admin") {
      const role = await Role.findOne({ name: user.role, isActive: true, isArchived: false }).lean();
      if (!role) return res.status(403).json({ message: "Role is inactive or unavailable" });
      permissions = {
        sidebar: role.sidebarPermissions ?? [],
        dashboard: role.dashboardPermissions ?? []
      };
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ sub: user._id }, env.jwtSecret, { expiresIn: "8h" });
    await logActivity(req, { action: "auth.login", entityType: "user", entityId: user._id, userId: user._id, newValue: { email: user.email, role: user.role } });

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions }
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  })
);
