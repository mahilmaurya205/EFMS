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
import { createHash, randomBytes } from "node:crypto";
import { RefreshSession } from "../models/RefreshSession.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { clearLoginAttempts, loginRateLimit } from "../middleware/security.js";
import { createTotpSecret, verifyTotp } from "../utils/totp.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
  ,otp: z.string().length(6).optional()
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const accessToken = (userId: unknown) => jwt.sign({ sub: userId, type: "access" }, env.jwtSecret, { expiresIn: "15m" });

async function createRefreshToken(userId: unknown, req: import("express").Request) {
  const token = jwt.sign({ sub: userId, type: "refresh", nonce: randomBytes(12).toString("hex") }, env.refreshSecret, { expiresIn: "7d" });
  await RefreshSession.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] ?? "")
  });
  return token;
}

authRouter.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() }).select("+twoFactorSecret");
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
    if (user.twoFactorEnabled && (!user.twoFactorSecret || !data.otp || !verifyTotp(user.twoFactorSecret, data.otp))) {
      return res.status(401).json({ message: data.otp ? "Invalid authentication code" : "Two-factor authentication code required", requiresOtp: true });
    }

    clearLoginAttempts(req);
    const token = accessToken(user._id);
    const refreshToken = await createRefreshToken(user._id, req);
    await logActivity(req, { action: "auth.login", entityType: "user", entityId: user._id, userId: user._id, newValue: { email: user.email, role: user.role } });

    return res.json({
      token,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions }
    });
  })
);

authRouter.post("/refresh", asyncHandler(async (req, res) => {
  const refreshToken = z.object({ refreshToken: z.string().min(20) }).parse(req.body).refreshToken;
  const payload = jwt.verify(refreshToken, env.refreshSecret) as { sub: string; type?: string };
  if (payload.type !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });
  const session = await RefreshSession.findOne({ tokenHash: hashToken(refreshToken), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!session) return res.status(401).json({ message: "Refresh session expired" });
  session.revokedAt = new Date();
  await session.save();
  res.json({ token: accessToken(payload.sub), refreshToken: await createRefreshToken(payload.sub, req) });
}));

authRouter.post("/logout", asyncHandler(async (req, res) => {
  const refreshToken = z.object({ refreshToken: z.string().optional() }).parse(req.body).refreshToken;
  if (refreshToken) await RefreshSession.updateOne({ tokenHash: hashToken(refreshToken) }, { revokedAt: new Date() });
  res.status(204).send();
}));

authRouter.post("/forgot-password", asyncHandler(async (req, res) => {
  const email = z.object({ email: z.string().email() }).parse(req.body).email.toLowerCase();
  const user = await User.findOne({ email });
  let resetToken: string | undefined;
  if (user) {
    resetToken = randomBytes(32).toString("hex");
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({ userId: user._id, tokenHash: hashToken(resetToken), expiresAt: new Date(Date.now() + 30 * 60_000) });
    await logActivity(req, { action: "auth.password_reset_requested", entityType: "user", entityId: user._id, userId: user._id });
  }
  res.json({ message: "If the account exists, reset instructions have been generated.", ...(env.exposeResetToken && resetToken ? { resetToken } : {}) });
}));

authRouter.post("/reset-password", asyncHandler(async (req, res) => {
  const data = z.object({ token: z.string().min(32), password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) }).parse(req.body);
  const reset = await PasswordReset.findOne({ tokenHash: hashToken(data.token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!reset) return res.status(400).json({ message: "Reset link is invalid or expired" });
  await User.findByIdAndUpdate(reset.userId, { passwordHash: await bcrypt.hash(data.password, 12) });
  reset.usedAt = new Date();
  await reset.save();
  await RefreshSession.updateMany({ userId: reset.userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  await logActivity(req, { action: "auth.password_reset", entityType: "user", entityId: reset.userId, userId: reset.userId });
  res.json({ message: "Password reset successful" });
}));

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  })
);

authRouter.post("/2fa/setup", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const secret = createTotpSecret();
  await User.findByIdAndUpdate(req.user!.id, { twoFactorPendingSecret: secret });
  const issuer = encodeURIComponent("EFMS");
  const label = encodeURIComponent(`EFMS:${req.user!.email}`);
  res.json({ secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30` });
}));

authRouter.post("/2fa/enable", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const otp = z.object({ otp: z.string().length(6) }).parse(req.body).otp;
  const user = await User.findById(req.user!.id).select("+twoFactorPendingSecret");
  if (!user?.twoFactorPendingSecret || !verifyTotp(user.twoFactorPendingSecret, otp)) return res.status(400).json({ message: "Invalid authentication code" });
  user.twoFactorSecret = user.twoFactorPendingSecret;
  user.twoFactorPendingSecret = undefined;
  user.twoFactorEnabled = true;
  await user.save();
  await logActivity(req, { action: "auth.2fa_enabled", entityType: "user", entityId: user._id });
  res.json({ enabled: true });
}));

authRouter.post("/2fa/disable", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const otp = z.object({ otp: z.string().length(6) }).parse(req.body).otp;
  const user = await User.findById(req.user!.id).select("+twoFactorSecret");
  if (!user?.twoFactorSecret || !verifyTotp(user.twoFactorSecret, otp)) return res.status(400).json({ message: "Invalid authentication code" });
  user.twoFactorSecret = undefined; user.twoFactorEnabled = false;
  await user.save();
  await logActivity(req, { action: "auth.2fa_disabled", entityType: "user", entityId: user._id });
  res.json({ enabled: false });
}));
