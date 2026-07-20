import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Role } from "../models/Role.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
    email: string;
    permissions?: {
      sidebar: string[];
      dashboard: string[];
    };
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) return res.status(401).json({ message: "Authentication required" });

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) return res.status(401).json({ message: "Invalid session" });
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
    req.user = {
      id: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      permissions
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Permission denied" });
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (req.user.role === "super_admin" || req.user.permissions?.sidebar.includes(permission)) return next();
    return res.status(403).json({ message: `Permission denied: ${permission}` });
  };
}
