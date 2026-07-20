import type { Request } from "express";
import { ActivityLog } from "../models/ActivityLog.js";
import { createHash } from "node:crypto";

export async function logActivity(req: Request, input: { action: string; entityType?: string; entityId?: unknown; userId?: unknown; oldValue?: unknown; newValue?: unknown; reason?: string }) {
  const user = (req as Request & { user?: { id: string } }).user;
  const userAgent = String(req.headers["user-agent"] || "");
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ipAddress = forwardedFor || req.socket.remoteAddress || req.ip;
  const previous = await ActivityLog.findOne().sort({ createdAt: -1, _id: -1 }).select("integrityHash").lean();
  const createdAt = new Date();
  const base = {
    userId: user?.id ?? input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason,
    ipAddress,
    userAgent,
    deviceType: getDeviceType(userAgent),
    browser: getBrowser(userAgent),
    os: getOs(userAgent),
    createdAt
  };
  const previousHash = previous?.integrityHash ?? "";
  const integrityHash = createHash("sha256").update(`${previousHash}|${JSON.stringify(base)}`).digest("hex");
  await ActivityLog.create({ ...base, previousHash, integrityHash });
}

function getDeviceType(userAgent: string) {
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "Mobile";
  if (/ipad|tablet/i.test(userAgent)) return "Tablet";
  return "Laptop/Desktop";
}

function getBrowser(userAgent: string) {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/opr|opera/i.test(userAgent)) return "Opera";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Unknown";
}

function getOs(userAgent: string) {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown";
}
