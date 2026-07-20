import type { NextFunction, Request, Response } from "express";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`;
  const now = Date.now();
  const state = attempts.get(key);
  if (state && state.resetAt > now && state.count >= 5) {
    res.setHeader("Retry-After", String(Math.ceil((state.resetAt - now) / 1000)));
    return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
  }
  if (!state || state.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  else state.count += 1;
  next();
}

export function clearLoginAttempts(req: Request) {
  attempts.delete(`${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`);
}
