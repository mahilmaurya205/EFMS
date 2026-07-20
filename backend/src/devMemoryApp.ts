import express from "express";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { env } from "./config/env.js";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  phone?: string;
  aadharNo?: string;
  address?: string;
  designation?: string;
  department?: string;
  basicSalary?: number;
  isActive?: boolean;
  joiningDate?: string;
};

type Earning = {
  _id: string;
  source: string;
  project?: string;
  customer: string;
  paymentMode: string;
  bankAccount?: string;
  referenceNo?: string;
  remarks?: string;
  gstApplicable: boolean;
  gstRate: number;
  gstAmount: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  createdAt: string;
};

type Expense = {
  _id: string;
  employeeId: User;
  category: string;
  purpose: string;
  amount: number;
  vendor?: string;
  remarks?: string;
  expectedDate: string;
  paidFrom?: "office" | "employee";
  spentByEmployeeId?: string;
  spentByEmployeeName?: string;
  paymentMode?: "cash" | "cheque" | "upi" | "bank" | "card" | "other";
  bankAccount?: string;
  proofFileName?: string;
  proofData?: string;
  paidByEmployee: boolean;
  status: string;
  currentStep: number;
  approvalSteps: Array<{ order: number; role: string; status: string }>;
  createdAt: string;
};

type Voucher = {
  _id: string;
  type: string;
  voucherNumber: string;
  amount: number;
  purpose: string;
  receiver?: string;
  paymentMode?: string;
  bankAccount?: string;
  referenceNo?: string;
  remarks?: string;
  status: string;
  createdAt: string;
};

type Invoice = {
  _id: string;
  type: string;
  invoiceNumber: string;
  customer: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  remarks?: string;
  status: string;
  createdAt: string;
};

type OperationalRecord = {
  _id: string;
  module: string;
  title: string;
  amount: number;
  status: string;
  remarks: string;
  fields: Record<string, unknown>;
  createdAt: string;
};

type MasterOption = {
  _id: string;
  type: "expense_category" | "earning_source" | "project";
  name: string;
  isArchived: boolean;
  createdAt: string;
};

type BankAccount = {
  _id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
};

type Role = {
  _id: string;
  name: string;
  description?: string;
  sidebarPermissions?: string[];
  dashboardPermissions?: string[];
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
};

type Transfer = {
  _id: string;
  type: "cash_to_bank" | "bank_to_cash";
  amount: number;
  bankAccount: string;
  referenceNo?: string;
  remarks?: string;
  transferDate: string;
  status: string;
  createdAt: string;
};

const admin: User = {
  id: "dev-admin",
  name: "EFMS Admin",
  email: "admin@efms.local",
  role: "super_admin"
};

const users: User[] = [admin];
const earnings: Earning[] = [];
const expenses: Expense[] = [];
const vouchers: Voucher[] = [];
const invoices: Invoice[] = [];
const records: OperationalRecord[] = [];
const masterOptions: MasterOption[] = [];
const bankAccounts: BankAccount[] = [];
const roles: Role[] = [];
const transfers: Transfer[] = [];
const activityLogs: unknown[] = [];

const memoryDbPath = path.resolve(process.cwd(), ".dev-memory-db.json");

function replaceArray<T>(target: T[], source?: T[]) {
  target.splice(0, target.length, ...(source ?? []));
}

function loadMemoryData() {
  if (!fs.existsSync(memoryDbPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(memoryDbPath, "utf8")) as {
      users?: User[];
      earnings?: Earning[];
      expenses?: Expense[];
      vouchers?: Voucher[];
      invoices?: Invoice[];
      records?: OperationalRecord[];
      masterOptions?: MasterOption[];
      bankAccounts?: BankAccount[];
      roles?: Role[];
      transfers?: Transfer[];
      activityLogs?: unknown[];
    };
    replaceArray(users, data.users?.length ? data.users : [admin]);
    if (!users.some((user) => user.id === admin.id)) users.push(admin);
    replaceArray(earnings, data.earnings);
    replaceArray(expenses, data.expenses);
    replaceArray(vouchers, data.vouchers);
    replaceArray(invoices, data.invoices);
    replaceArray(records, data.records);
    replaceArray(masterOptions, data.masterOptions);
    replaceArray(bankAccounts, data.bankAccounts);
    replaceArray(roles, data.roles);
    replaceArray(transfers, data.transfers);
    replaceArray(activityLogs, data.activityLogs);
  } catch (error) {
    console.warn("Could not load local memory data file.", error instanceof Error ? error.message : error);
  }
}

function saveMemoryData() {
  const data = { users, earnings, expenses, vouchers, invoices, records, masterOptions, bankAccounts, roles, transfers, activityLogs };
  try {
    fs.writeFileSync(memoryDbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn("Could not save local memory data file.", error instanceof Error ? error.message : error);
  }
}

loadMemoryData();

function bankRecordEffect(record: OperationalRecord) {
  const status = record.status.toLowerCase();
  if (["credit", "received", "deposit", "active"].includes(status)) return record.amount;
  if (["debit", "spent", "withdrawn", "payment"].includes(status)) return -record.amount;
  return 0;
}

function accountLabel(account: BankAccount) {
  return `${account.bankName} - ${account.accountNumber}`;
}

function calculatedBankAccountBalance(account: BankAccount) {
  const label = accountLabel(account);
  const earningTotal = earnings
    .filter((earning) => earning.status !== "archived" && earning.paymentMode !== "cash")
    .filter((earning) => earning.bankAccount === label || earning.bankAccount === account.bankName || earning.bankAccount === account.accountNumber)
    .reduce((sum, earning) => sum + earning.paidAmount, 0);
  const bankBookTotal = records
    .filter((record) => record.module === "bank" && record.status !== "archived")
    .filter((record) => record.fields.bankName === account.bankName || record.fields.accountNumber === account.accountNumber || record.title === account.bankName || record.title === label)
    .reduce((sum, record) => sum + bankRecordEffect(record), 0);
  const officeExpenseTotal = expenses
    .filter((expense) => expense.status !== "archived" && expense.paidFrom === "office" && expense.paymentMode !== "cash")
    .filter((expense) => expense.bankAccount === label || expense.bankAccount === account.bankName || expense.bankAccount === account.accountNumber)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const transferTotal = transfers
    .filter((transfer) => transfer.status !== "archived")
    .filter((transfer) => transfer.bankAccount === label || transfer.bankAccount === account.bankName || transfer.bankAccount === account.accountNumber)
    .reduce((sum, transfer) => sum + (transfer.type === "cash_to_bank" ? transfer.amount : -transfer.amount), 0);
  const voucherTotal = vouchers
    .filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode !== "cash")
    .filter((voucher) => voucher.bankAccount === label || voucher.bankAccount === account.bankName || voucher.bankAccount === account.accountNumber)
    .reduce((sum, voucher) => sum + voucher.amount, 0);
  return account.currentBalance + earningTotal + bankBookTotal - officeExpenseTotal + transferTotal - voucherTotal;
}

function requireDevAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = users.find((item) => item.id === payload.sub);
    if (!user) return res.status(401).json({ message: "Invalid session" });
    if (user.isActive === false) return res.status(401).json({ message: "Invalid session" });
    if (user.role === "employee") return res.status(403).json({ message: "Employee login is disabled" });
    const role = user.role === "super_admin" ? undefined : roles.find((item) => item.name === user.role && item.isActive && !item.isArchived);
    if (user.role !== "super_admin" && !role) return res.status(403).json({ message: "Role is inactive or unavailable" });
    (req as express.Request & { user: User & { permissions?: { sidebar: string[]; dashboard: string[] } } }).user = {
      ...user,
      permissions: { sidebar: role?.sidebarPermissions ?? [], dashboard: role?.dashboardPermissions ?? [] }
    };
    next();
  } catch {
    res.status(401).json({ message: "Authentication required" });
  }
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRole(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export function createDevMemoryApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (req.method !== "GET" && res.statusCode < 400) saveMemoryData();
    });
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "efms-backend", mode: "memory" });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (email !== "admin@efms.local" || password !== "Htech@2026#") {
      const user = users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
      if (!user || user.role === "employee" || user.isActive === false || user.role === "super_admin" || user.password !== password) return res.status(401).json({ message: "Invalid credentials" });
      const role = roles.find((item) => item.name === user.role && item.isActive && !item.isArchived);
      if (!role) return res.status(403).json({ message: "Role is inactive or unavailable" });
      const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: "8h" });
      activityLogs.unshift({ action: "auth.login", userId: user.id, createdAt: new Date().toISOString() });
      return res.json({ token, user: { ...user, permissions: { sidebar: role.sidebarPermissions ?? [], dashboard: role.dashboardPermissions ?? [] } } });
    }
    const token = jwt.sign({ sub: admin.id }, env.jwtSecret, { expiresIn: "8h" });
    activityLogs.unshift({ action: "auth.login", userId: admin.id, createdAt: new Date().toISOString() });
    res.json({ token, user: admin });
  });

  app.get("/api/auth/me", requireDevAuth, (req, res) => {
    res.json({ user: (req as express.Request & { user: User }).user });
  });

  app.get("/api/dashboard", requireDevAuth, (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayIncome = earnings
      .filter((earning) => earning.createdAt.startsWith(today))
      .reduce((sum, earning) => sum + earning.paidAmount, 0);
    const todayExpense = expenses
      .filter((expense) => expense.createdAt.startsWith(today) && expense.status !== "archived")
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = earnings
      .filter((earning) => earning.status !== "archived")
      .reduce((sum, earning) => sum + earning.paidAmount, 0);
    const totalExpense = expenses
      .filter((expense) => expense.status !== "archived")
      .reduce((sum, expense) => sum + expense.amount, 0);
    const cashInHand = earnings
      .filter((earning) => earning.status !== "archived" && earning.paymentMode === "cash")
      .reduce((sum, earning) => sum + earning.paidAmount, 0) -
      expenses
        .filter((expense) => expense.status !== "archived" && expense.paidFrom === "office" && expense.paymentMode === "cash")
        .reduce((sum, expense) => sum + expense.amount, 0) -
      transfers
        .filter((transfer) => transfer.status !== "archived" && transfer.type === "cash_to_bank")
        .reduce((sum, transfer) => sum + transfer.amount, 0) +
      transfers
        .filter((transfer) => transfer.status !== "archived" && transfer.type === "bank_to_cash")
        .reduce((sum, transfer) => sum + transfer.amount, 0) -
      vouchers
        .filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode === "cash")
        .reduce((sum, voucher) => sum + voucher.amount, 0);
    const bankBalance =
      bankAccounts
        .filter((account) => !account.isArchived && account.isActive !== false)
        .reduce((sum, account) => sum + calculatedBankAccountBalance(account), 0) +
      earnings
        .filter((earning) => earning.status !== "archived" && earning.paymentMode !== "cash" && !earning.bankAccount)
        .reduce((sum, earning) => sum + earning.paidAmount, 0);

    res.json({
      totalIncome,
      totalExpense,
      todayIncome,
      todayExpense,
      users: users.length,
      vouchers: vouchers.length,
      cashInHand,
      bankBalance,
      totalBalance: bankBalance + cashInHand
    });
  });

  app.get("/api/earnings", requireDevAuth, (_req, res) => {
    res.json(earnings);
  });

  app.post("/api/earnings", requireDevAuth, (req, res) => {
    const body = req.body as Omit<Earning, "_id" | "gstAmount" | "remainingAmount" | "status" | "createdAt">;
    const gstAmount = 0;
    const paidAmount = Number(body.paidAmount || 0);
    const amount = Number(body.amount || paidAmount);
    const total = amount;
    const remainingAmount = Math.max(total - paidAmount, 0);
    const earning: Earning = {
      ...body,
      _id: id("earning"),
      amount,
      paidAmount,
      gstApplicable: false,
      gstRate: 0,
      remarks: body.remarks,
      gstAmount,
      remainingAmount,
      status: remainingAmount === 0 ? "paid" : paidAmount > 0 ? "partial" : "pending",
      createdAt: new Date().toISOString()
    };
    earnings.unshift(earning);
    activityLogs.unshift({ action: "earning.create", entityType: "earning", entityId: earning._id, createdAt: earning.createdAt });
    res.status(201).json(earning);
  });

  app.patch("/api/earnings/:id", requireDevAuth, (req, res) => {
    const earning = earnings.find((item) => item._id === req.params.id);
    if (!earning) return res.status(404).json({ message: "Earning not found" });
    Object.assign(earning, req.body);
    const amount = Number(earning.paidAmount || earning.amount || 0);
    earning.amount = amount;
    earning.gstApplicable = false;
    earning.gstRate = 0;
    earning.gstAmount = 0;
    const total = amount;
    earning.remainingAmount = Math.max(total - Number(earning.paidAmount || 0), 0);
    earning.status = earning.remainingAmount === 0 ? "paid" : earning.paidAmount > 0 ? "partial" : "pending";
    activityLogs.unshift({ action: "earning.update", entityType: "earning", entityId: earning._id, createdAt: new Date().toISOString() });
    res.json(earning);
  });

  app.delete("/api/earnings/:id", requireDevAuth, (req, res) => {
    const earning = earnings.find((item) => item._id === req.params.id);
    if (!earning) return res.status(404).json({ message: "Earning not found" });
    earning.status = "archived";
    activityLogs.unshift({ action: "earning.archive", entityType: "earning", entityId: earning._id, createdAt: new Date().toISOString() });
    res.json(earning);
  });

  app.get("/api/expenses", requireDevAuth, (_req, res) => {
    res.json(expenses.filter((expense) => expense.status !== "archived"));
  });

  app.post("/api/expenses", requireDevAuth, (req, res) => {
    const body = req.body as Partial<Expense>;
    const expense: Expense = {
      _id: id("expense"),
      employeeId: admin,
      category: body.category ?? "Office Expense",
      purpose: body.purpose ?? "",
      amount: Number(body.amount ?? 0),
      vendor: body.vendor,
      remarks: body.remarks,
      expectedDate: String(body.expectedDate ?? new Date().toISOString()),
      paidFrom: body.paidFrom || "office",
      spentByEmployeeId: body.spentByEmployeeId,
      spentByEmployeeName: body.spentByEmployeeName,
      paymentMode: body.paymentMode || "cash",
      bankAccount: body.bankAccount || "",
      proofFileName: body.proofFileName,
      proofData: body.proofData,
      paidByEmployee: body.paidFrom === "employee" || Boolean(body.paidByEmployee),
      status: "entered",
      currentStep: 0,
      approvalSteps: [],
      createdAt: new Date().toISOString()
    };
    expenses.unshift(expense);
    activityLogs.unshift({ action: "expense.create", entityType: "expense", entityId: expense._id, createdAt: expense.createdAt });
    res.status(201).json(expense);
  });

  app.patch("/api/expenses/:id", requireDevAuth, (req, res) => {
    const expense = expenses.find((item) => item._id === req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    Object.assign(expense, req.body);
    expense.paidByEmployee = expense.paidFrom === "employee";
    if (expense.paidFrom === "employee") expense.bankAccount = "";
    expense.status = "entered";
    activityLogs.unshift({ action: "expense.update", entityType: "expense", entityId: expense._id, createdAt: new Date().toISOString() });
    res.json(expense);
  });

  app.delete("/api/expenses/:id", requireDevAuth, (req, res) => {
    const expense = expenses.find((item) => item._id === req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    expense.status = "archived";
    activityLogs.unshift({ action: "expense.archive", entityType: "expense", entityId: expense._id, createdAt: new Date().toISOString() });
    res.json(expense);
  });

  app.patch("/api/expenses/:id/approve", requireDevAuth, (req, res) => {
    const expense = expenses.find((item) => item._id === req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    const step = expense.approvalSteps[expense.currentStep];
    if (step) step.status = "approved";
    expense.currentStep += 1;
    expense.status = expense.currentStep >= expense.approvalSteps.length ? "approved" : "pending_approval";
    res.json(expense);
  });

  app.patch("/api/expenses/:id/reject", requireDevAuth, (req, res) => {
    const expense = expenses.find((item) => item._id === req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    expense.status = "rejected";
    res.json(expense);
  });

  app.patch("/api/expenses/:id/verify", requireDevAuth, (req, res) => {
    const expense = expenses.find((item) => item._id === req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    expense.status = "posted";
    vouchers.unshift({
      _id: id("voucher"),
      type: "expense",
      voucherNumber: `EV${String(vouchers.length + 1).padStart(5, "0")}`,
      amount: expense.amount,
      purpose: expense.purpose,
      status: "issued",
      createdAt: new Date().toISOString()
    });
    res.json(expense);
  });

  app.get("/api/vouchers", requireDevAuth, (_req, res) => {
    res.json(vouchers);
  });

  app.post("/api/vouchers", requireDevAuth, (req, res) => {
    const body = req.body as Partial<Voucher>;
    const type = body.type || "payment";
    const voucher: Voucher = {
      _id: id("voucher"),
      type,
      voucherNumber: `${type.slice(0, 1).toUpperCase()}V${String(vouchers.length + 1).padStart(5, "0")}`,
      amount: Number(body.amount || 0),
      purpose: body.purpose || "",
      receiver: body.receiver || "",
      paymentMode: body.paymentMode || "cash",
      bankAccount: body.bankAccount || "",
      referenceNo: body.referenceNo || "",
      remarks: body.remarks || "",
      status: "issued",
      createdAt: new Date().toISOString()
    };
    vouchers.unshift(voucher);
    activityLogs.unshift({ action: "voucher.create", entityType: "voucher", entityId: voucher._id, createdAt: voucher.createdAt });
    res.status(201).json(voucher);
  });

  app.patch("/api/vouchers/:id", requireDevAuth, (req, res) => {
    const voucher = vouchers.find((item) => item._id === req.params.id);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    Object.assign(voucher, req.body);
    res.json(voucher);
  });

  app.delete("/api/vouchers/:id", requireDevAuth, (req, res) => {
    const voucher = vouchers.find((item) => item._id === req.params.id);
    if (!voucher) return res.status(404).json({ message: "Voucher not found" });
    voucher.status = "cancelled";
    res.json(voucher);
  });

  app.get("/api/invoices", requireDevAuth, (_req, res) => {
    res.json(invoices);
  });

  app.post("/api/invoices", requireDevAuth, (req, res) => {
    const body = req.body as { customer?: string; remarks?: string };
    const invoice: Invoice = {
      _id: id("invoice"),
      type: "tax_invoice",
      invoiceNumber: "TI00001",
      customer: body.customer || "Demo Customer",
      subtotal: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
      remarks: body.remarks || "",
      status: "issued",
      createdAt: new Date().toISOString()
    };
    invoices.unshift(invoice);
    res.status(201).json(invoice);
  });

  app.patch("/api/invoices/:id", requireDevAuth, (req, res) => {
    const invoice = invoices.find((item) => item._id === req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    Object.assign(invoice, req.body);
    res.json(invoice);
  });

  app.delete("/api/invoices/:id", requireDevAuth, (req, res) => {
    const invoice = invoices.find((item) => item._id === req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    invoice.status = "cancelled";
    res.json(invoice);
  });

  app.get("/api/users", requireDevAuth, (_req, res) => {
    const employeeExpenseTotals = expenses
      .filter((expense) => expense.status !== "archived" && expense.paidFrom === "employee")
      .reduce<Record<string, number>>((totals, expense) => {
        const employeeId = expense.spentByEmployeeId || "";
        totals[employeeId] = (totals[employeeId] || 0) + expense.amount;
        return totals;
      }, {});
    res.json(users.map((user) => {
      const expenseTotal = employeeExpenseTotals[user.id] || 0;
      return { ...user, isActive: user.isActive !== false, expenseTotal, totalPayable: Number(user.basicSalary || 0) + expenseTotal };
    }));
  });

  app.get("/api/roles", requireDevAuth, (_req, res) => {
    res.json(roles.filter((role) => !role.isArchived).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post("/api/roles", requireDevAuth, (req, res) => {
    const body = req.body as Partial<Role>;
    if (!body.name || body.name.trim().length < 2) return res.status(400).json({ message: "Role name is required" });
    const name = normalizeRole(body.name);
    if (["super_admin", "employee"].includes(name)) return res.status(400).json({ message: "This role is fixed and cannot be created here" });
    if (roles.some((role) => role.name === name && !role.isArchived)) return res.status(400).json({ message: "Role already exists" });
    const role: Role = { _id: id("role"), name, description: body.description || "", sidebarPermissions: body.sidebarPermissions || [], dashboardPermissions: body.dashboardPermissions || [], isActive: body.isActive ?? true, isArchived: false, createdAt: new Date().toISOString() };
    roles.unshift(role);
    activityLogs.unshift({ action: "role.create", entityType: "role", entityId: role._id, createdAt: role.createdAt });
    res.status(201).json(role);
  });

  app.patch("/api/roles/:id", requireDevAuth, (req, res) => {
    const role = roles.find((item) => item._id === req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });
    const body = req.body as Partial<Role>;
    if (body.name) role.name = normalizeRole(body.name);
    if (body.description !== undefined) role.description = body.description;
    if (body.sidebarPermissions !== undefined) role.sidebarPermissions = body.sidebarPermissions;
    if (body.dashboardPermissions !== undefined) role.dashboardPermissions = body.dashboardPermissions;
    if (body.isActive !== undefined) role.isActive = body.isActive;
    activityLogs.unshift({ action: "role.update", entityType: "role", entityId: role._id, createdAt: new Date().toISOString() });
    res.json(role);
  });

  app.delete("/api/roles/:id", requireDevAuth, (req, res) => {
    const role = roles.find((item) => item._id === req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });
    role.isArchived = true;
    role.isActive = false;
    activityLogs.unshift({ action: "role.archive", entityType: "role", entityId: role._id, createdAt: new Date().toISOString() });
    res.json(role);
  });

  app.post("/api/users", requireDevAuth, (req, res) => {
    const body = req.body as Partial<User>;
    if (!body.name || !body.email) return res.status(400).json({ message: "Name and email are required" });
    const user: User = {
      id: id("user"),
      name: body.name,
      email: body.email,
      role: body.role || "employee",
      password: body.password || "",
      phone: body.phone || "",
      aadharNo: body.aadharNo || "",
      address: body.address || "",
      designation: body.designation || "",
      department: body.department || "General",
      basicSalary: Number(body.basicSalary || 0),
      isActive: body.isActive ?? true,
      joiningDate: body.joiningDate
    };
    users.unshift(user);
    activityLogs.unshift({ action: "user.create", entityType: "user", entityId: user.id, createdAt: new Date().toISOString() });
    res.status(201).json(user);
  });

  app.patch("/api/users/:id", requireDevAuth, (req, res) => {
    const user = users.find((item) => item.id === req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const body = req.body as Partial<User>;
    if (body.name) user.name = body.name;
    if (body.email) user.email = body.email;
    if (body.role) user.role = body.role;
    if (body.password !== undefined) user.password = body.password;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.aadharNo !== undefined) user.aadharNo = body.aadharNo;
    if (body.address !== undefined) user.address = body.address;
    if (body.designation !== undefined) user.designation = body.designation;
    if (body.department !== undefined) user.department = body.department;
    if (body.basicSalary !== undefined) user.basicSalary = Number(body.basicSalary);
    if (body.isActive !== undefined) user.isActive = body.isActive;
    if (body.joiningDate !== undefined) user.joiningDate = body.joiningDate;
    activityLogs.unshift({ action: "user.update", entityType: "user", entityId: user.id, createdAt: new Date().toISOString() });
    res.json(user);
  });

  app.delete("/api/users/:id", requireDevAuth, (req, res) => {
    const user = users.find((item) => item.id === req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.isActive = false;
    activityLogs.unshift({ action: "user.archive", entityType: "user", entityId: user.id, createdAt: new Date().toISOString() });
    res.json(user);
  });

  app.get("/api/bank-accounts", requireDevAuth, (_req, res) => {
    res.json(bankAccounts.filter((account) => !account.isArchived).map((account) => ({ ...account, currentBalance: calculatedBankAccountBalance(account) })));
  });

  app.post("/api/bank-accounts", requireDevAuth, (req, res) => {
    const body = req.body as Partial<BankAccount>;
    if (!body.bankName || !body.accountNumber) return res.status(400).json({ message: "Bank name and account number are required" });
    const account: BankAccount = {
      _id: id("bank-account"),
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      currentBalance: Number(body.currentBalance || 0),
      isActive: body.isActive ?? true,
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    bankAccounts.unshift(account);
    activityLogs.unshift({ action: "bank_account.create", entityType: "bank_account", entityId: account._id, createdAt: account.createdAt });
    res.status(201).json(account);
  });

  app.patch("/api/bank-accounts/:id", requireDevAuth, (req, res) => {
    const account = bankAccounts.find((item) => item._id === req.params.id);
    if (!account) return res.status(404).json({ message: "Bank account not found" });
    const body = req.body as Partial<BankAccount>;
    if (body.bankName) account.bankName = body.bankName;
    if (body.accountNumber) account.accountNumber = body.accountNumber;
    if (body.currentBalance !== undefined) account.currentBalance = Number(body.currentBalance);
    if (body.isActive !== undefined) account.isActive = body.isActive;
    activityLogs.unshift({ action: "bank_account.update", entityType: "bank_account", entityId: account._id, createdAt: new Date().toISOString() });
    res.json(account);
  });

  app.delete("/api/bank-accounts/:id", requireDevAuth, (req, res) => {
    const account = bankAccounts.find((item) => item._id === req.params.id);
    if (!account) return res.status(404).json({ message: "Bank account not found" });
    account.isArchived = true;
    activityLogs.unshift({ action: "bank_account.archive", entityType: "bank_account", entityId: account._id, createdAt: new Date().toISOString() });
    res.json(account);
  });

  app.get("/api/transfers", requireDevAuth, (_req, res) => {
    res.json(transfers.filter((transfer) => transfer.status !== "archived").sort((a, b) => b.transferDate.localeCompare(a.transferDate)));
  });

  app.post("/api/transfers", requireDevAuth, (req, res) => {
    const body = req.body as Partial<Transfer>;
    if (!body.type || !body.amount || !body.bankAccount || !body.transferDate) return res.status(400).json({ message: "Transfer type, amount, bank account and date are required" });
    const transfer: Transfer = {
      _id: id("transfer"),
      type: body.type,
      amount: Number(body.amount),
      bankAccount: body.bankAccount,
      referenceNo: body.referenceNo || "",
      remarks: body.remarks || "",
      transferDate: body.transferDate,
      status: "active",
      createdAt: new Date().toISOString()
    };
    transfers.unshift(transfer);
    activityLogs.unshift({ action: "transfer.create", entityType: "transfer", entityId: transfer._id, createdAt: transfer.createdAt });
    res.status(201).json(transfer);
  });

  app.patch("/api/transfers/:id", requireDevAuth, (req, res) => {
    const transfer = transfers.find((item) => item._id === req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    Object.assign(transfer, req.body);
    transfer.amount = Number(transfer.amount);
    activityLogs.unshift({ action: "transfer.update", entityType: "transfer", entityId: transfer._id, createdAt: new Date().toISOString() });
    res.json(transfer);
  });

  app.delete("/api/transfers/:id", requireDevAuth, (req, res) => {
    const transfer = transfers.find((item) => item._id === req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    transfer.status = "archived";
    activityLogs.unshift({ action: "transfer.archive", entityType: "transfer", entityId: transfer._id, createdAt: new Date().toISOString() });
    res.json(transfer);
  });

  app.get("/api/activity", requireDevAuth, (_req, res) => {
    res.json(activityLogs);
  });

  app.get("/api/options/:type", requireDevAuth, (req, res) => {
    res.json(masterOptions.filter((option) => option.type === req.params.type && !option.isArchived).sort((a, b) => a.name.localeCompare(b.name)));
  });

  app.post("/api/options/:type", requireDevAuth, (req, res) => {
    const type = req.params.type === "expense_category" ? "expense_category" : req.params.type === "project" ? "project" : "earning_source";
    const body = req.body as { name?: string };
    if (!body.name || body.name.trim().length < 2) return res.status(400).json({ message: "Name is required" });
    const option: MasterOption = {
      _id: id(type),
      type,
      name: body.name.trim(),
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    masterOptions.unshift(option);
    activityLogs.unshift({ action: `${type}.create`, entityType: "master_option", entityId: option._id, createdAt: option.createdAt });
    res.status(201).json(option);
  });

  app.patch("/api/options/:type/:id", requireDevAuth, (req, res) => {
    const option = masterOptions.find((item) => item._id === req.params.id && item.type === req.params.type);
    if (!option) return res.status(404).json({ message: "Option not found" });
    const body = req.body as { name?: string };
    if (body.name) option.name = body.name.trim();
    res.json(option);
  });

  app.delete("/api/options/:type/:id", requireDevAuth, (req, res) => {
    const option = masterOptions.find((item) => item._id === req.params.id && item.type === req.params.type);
    if (!option) return res.status(404).json({ message: "Option not found" });
    option.isArchived = true;
    res.json(option);
  });

  app.get("/api/records/:module", requireDevAuth, (req, res) => {
    res.json(records.filter((record) => record.module === req.params.module));
  });

  app.post("/api/records/:module", requireDevAuth, (req, res) => {
    const body = req.body as Partial<OperationalRecord>;
    const module = String(req.params.module);
    const record: OperationalRecord = {
      _id: id(module),
      module,
      title: body.title || "Untitled",
      amount: Number(body.amount || 0),
      status: body.status || "active",
      remarks: body.remarks || "",
      fields: body.fields || {},
      createdAt: new Date().toISOString()
    };
    records.unshift(record);
    activityLogs.unshift({ action: `${record.module}.create`, entityType: record.module, entityId: record._id, createdAt: record.createdAt });
    res.status(201).json(record);
  });

  app.patch("/api/records/:module/:id", requireDevAuth, (req, res) => {
    const record = records.find((item) => item.module === req.params.module && item._id === req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    Object.assign(record, req.body);
    activityLogs.unshift({ action: `${record.module}.update`, entityType: record.module, entityId: record._id, createdAt: new Date().toISOString() });
    res.json(record);
  });

  app.delete("/api/records/:module/:id", requireDevAuth, (req, res) => {
    const record = records.find((item) => item.module === req.params.module && item._id === req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    record.status = "archived";
    activityLogs.unshift({ action: `${record.module}.archive`, entityType: record.module, entityId: record._id, createdAt: new Date().toISOString() });
    res.json(record);
  });

  return app;
}
