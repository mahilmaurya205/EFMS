import express from "express";
import cors from "cors";
import morgan from "morgan";
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
import { securityHeaders } from "./middleware/security.js";
import { dataSafetyRouter } from "./routes/dataSafety.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(securityHeaders);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "efms-backend" }));

app.use("/api/auth", authRouter);
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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ message });
});
