import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers["x-request-id"] === "string" && /^[a-zA-Z0-9-]{8,80}$/.test(req.headers["x-request-id"])
    ? req.headers["x-request-id"]
    : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
}

const response = { message: "Too many requests. Please try again later." };

export const apiRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 500, standardHeaders: "draft-8", legacyHeaders: false, message: response });
export const authRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: response });
export const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, skipSuccessfulRequests: true, message: { message: "Too many failed login attempts. Try again in 15 minutes." } });
export const sensitiveRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: response });

export function clearLoginAttempts(_req: Request) {}

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin")?.replace(/\/$/, "");
  if (origin && env.clientOrigins.includes(origin)) return next();
  return res.status(403).json({ message: "Untrusted request origin" });
}
