import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Expense } from "../models/Expense.js";
import { Earning } from "../models/Earning.js";
import { generateReportPdf } from "../services/pdf.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requirePermission("reports"));

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

function range(query: unknown) {
  const parsed = rangeSchema.parse(query);
  const now = new Date();
  const from = parsed.from ? new Date(`${parsed.from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = parsed.to ? new Date(`${parsed.to}T23:59:59.999Z`) : now;
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from > to) throw new Error("Invalid date range");
  return { from, to };
}

analyticsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req.query);
    const match = { createdAt: { $gte: from, $lte: to }, status: { $ne: "archived" } };
    const [expenses, earnings] = await Promise.all([
      Expense.find(match).populate("employeeId", "name department").lean(),
      Earning.find(match).lean()
    ]);
    const monthMap = new Map<string, { month: string; income: number; expense: number }>();
    const ensureMonth = (date: Date | string) => {
      const key = new Date(date).toISOString().slice(0, 7);
      if (!monthMap.has(key)) monthMap.set(key, { month: key, income: 0, expense: 0 });
      return monthMap.get(key)!;
    };
    const categories = new Map<string, number>();
    const employees = new Map<string, number>();
    const vendors = new Map<string, number>();
    let totalExpense = 0;
    let totalIncome = 0;
    expenses.forEach((item) => {
      totalExpense += item.amount;
      ensureMonth(item.createdAt).expense += item.amount;
      categories.set(item.category, (categories.get(item.category) ?? 0) + item.amount);
      const employee = typeof item.employeeId === "object" && item.employeeId ? String((item.employeeId as { name?: string }).name ?? "Unknown") : "Unknown";
      employees.set(employee, (employees.get(employee) ?? 0) + item.amount);
      const vendor = item.vendor || "Unspecified";
      vendors.set(vendor, (vendors.get(vendor) ?? 0) + item.amount);
    });
    earnings.forEach((item) => {
      totalIncome += item.paidAmount;
      ensureMonth(item.createdAt).income += item.paidAmount;
    });
    const ranked = (values: Map<string, number>) => [...values].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    res.json({
      from,
      to,
      totals: { income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense },
      monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({ ...item, net: item.income - item.expense })),
      categoryExpenses: ranked(categories),
      employeeExpenses: ranked(employees),
      vendorExpenses: ranked(vendors)
    });
  })
);

analyticsRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const { from, to } = range(req.query);
    const format = z.enum(["csv", "excel"]).default("csv").parse(req.query.format);
    const [expenses, earnings] = await Promise.all([
      Expense.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: "archived" } }).populate("employeeId", "name").lean(),
      Earning.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: "archived" } }).lean()
    ]);
    const rows = [
      ["Type", "Date", "Party", "Category/Source", "Amount", "Status"],
      ...expenses.map((x) => ["Expense", new Date(x.createdAt).toISOString().slice(0, 10), x.vendor || (typeof x.employeeId === "object" ? String((x.employeeId as { name?: string }).name ?? "") : ""), x.category, String(x.amount), x.status]),
      ...earnings.map((x) => ["Income", new Date(x.createdAt).toISOString().slice(0, 10), x.customer, x.source, String(x.paidAmount), x.status])
    ];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="efms-report-${from.toISOString().slice(0, 10)}.csv"`);
      return res.send(`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`);
    }
    const xmlRows = rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${Number.isFinite(Number(cell)) && cell !== "" ? "Number" : "String"}">${String(cell).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</Data></Cell>`).join("")}</Row>`).join("");
    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader("Content-Disposition", `attachment; filename="efms-report-${from.toISOString().slice(0, 10)}.xls"`);
    return res.send(`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="EFMS Report"><Table>${xmlRows}</Table></Worksheet></Workbook>`);
  })
);

analyticsRouter.get("/pdf", asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  const [expenses, earnings] = await Promise.all([
    Expense.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: "archived" } }).populate("employeeId", "name").sort({ createdAt: 1 }).lean(),
    Earning.find({ createdAt: { $gte: from, $lte: to }, status: { $ne: "archived" } }).sort({ createdAt: 1 }).lean()
  ]);
  const rows = [
    ...expenses.map((item) => ({ type: "Expense", date: new Date(item.createdAt).toLocaleDateString("en-IN"), party: item.vendor || (typeof item.employeeId === "object" ? String((item.employeeId as { name?: string }).name ?? "") : ""), category: item.category, amount: item.amount, status: item.status })),
    ...earnings.map((item) => ({ type: "Income", date: new Date(item.createdAt).toLocaleDateString("en-IN"), party: item.customer, category: item.source, amount: item.paidAmount, status: item.status }))
  ].sort((a, b) => a.date.localeCompare(b.date));
  const buffer = await generateReportPdf({ from, to, rows, income: earnings.reduce((sum, item) => sum + item.paidAmount, 0), expense: expenses.reduce((sum, item) => sum + item.amount, 0) });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="efms-financial-statement-${from.toISOString().slice(0, 10)}.pdf"`);
  res.send(buffer);
}));
