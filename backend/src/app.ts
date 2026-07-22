import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { expensesRouter } from "./routes/expenses.js";
import { vouchersRouter } from "./routes/vouchers.js";
import { invoicesRouter } from "./routes/invoices.js";
import { approvalRulesRouter } from "./routes/approvalRules.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { activityRouter } from "./routes/activity.js";
import { earningsRouter } from "./routes/earnings.js";
import { recordsRouter } from "./routes/records.js";
import { masterOptionsRouter } from "./routes/masterOptions.js";
import { bankAccountsRouter } from "./routes/bankAccounts.js";
import { transfersRouter } from "./routes/transfers.js";
import { rolesRouter } from "./routes/roles.js";
import { analyticsRouter } from "./routes/analytics.js";
import { budgetsRouter } from "./routes/budgets.js";
import { reconciliationRouter } from "./routes/reconciliation.js";
import { apiRateLimit, authRateLimit, requestContext } from "./middleware/security.js";
import { dataSafetyRouter } from "./routes/dataSafety.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestContext);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientOrigins.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
  maxAge: 86400
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "2mb", strict: true, type: "application/json" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "efms-backend" }));

app.use("/api", apiRateLimit);
app.use("/api/auth", authRateLimit, authRouter);
app.use("/api/users", usersRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/vouchers", vouchersRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/earnings", earningsRouter);
app.use("/api/approval-rules", approvalRulesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/activity", activityRouter);
app.use("/api/records", recordsRouter);
app.use("/api/options", masterOptionsRouter);
app.use("/api/bank-accounts", bankAccountsRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/reconciliation", reconciliationRouter);
app.use("/api/data-safety", dataSafetyRouter);

app.use((_req, res) => res.status(404).json({ message: "Endpoint not found", requestId: res.locals.requestId }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof ZodError) return res.status(400).json({ message: "Invalid request", issues: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), requestId: res.locals.requestId });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: "Invalid identifier", requestId: res.locals.requestId });
  if ((err as { code?: number }).code === 11000) return res.status(409).json({ message: "A record with this value already exists", requestId: res.locals.requestId });
  const message = env.nodeEnv === "production" ? "Internal server error" : err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ message, requestId: res.locals.requestId });
});
