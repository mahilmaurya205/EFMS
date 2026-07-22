import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeIndianRupee,
  Banknote,
  CheckCircle2,
  ClipboardList,
  DatabaseBackup,
  Download,
  ArrowLeftRight,
  FolderOpen,
  Pencil,
  FileText,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Sun,
  Trash2,
  TrendingUp,
  ShieldCheck,
  Users,
  XCircle
} from "lucide-react";
import { api, apiBlob, clearToken, getToken, refreshAccessToken, rupee, setToken, type User } from "./api";
import type { BankAccount, Budget, Expense, Invoice, MasterOption, OperationalRecord, Payroll, RoleOption, StatementEntry, Transfer, Voucher } from "./types";
import type { Earning } from "./types";

type Dashboard = {
  totalExpense: number;
  totalIncome: number;
  todayExpense: number;
  todayIncome: number;
  users: number;
  vouchers: number;
  cashInHand: number;
  bankBalance: number;
  totalBalance: number;
};

const PAGE_SIZE = 10;
type DashboardCardId = "earnings" | "expenses" | "todayIncome" | "todayExpense" | "bank" | "cash" | "balance" | "vouchers" | "users";

type DialogRequest = {
  mode: "confirm" | "prompt";
  title: string;
  message: string;
  initialValue?: string;
  inputType?: "text" | "number" | "email";
  confirmLabel: string;
  resolve: (value: boolean | string | null) => void;
};

function openDialog(request: Omit<DialogRequest, "resolve">) {
  return new Promise<boolean | string | null>((resolve) => {
    window.dispatchEvent(new CustomEvent<DialogRequest>("efms:dialog", { detail: { ...request, resolve } }));
  });
}

async function confirmPopup(message: string, title = "Please confirm", confirmLabel = "Confirm") {
  return await openDialog({ mode: "confirm", title, message, confirmLabel }) === true;
}

async function promptPopup(message: string, initialValue = "", title = "Enter details", inputType: "text" | "number" | "email" = "text") {
  const result = await openDialog({ mode: "prompt", title, message, initialValue, inputType, confirmLabel: "Continue" });
  return typeof result === "string" ? result : null;
}

function DialogHost() {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const listener = (event: Event) => {
      const request = (event as CustomEvent<DialogRequest>).detail;
      setValue(request.initialValue ?? "");
      setDialog(request);
    };
    window.addEventListener("efms:dialog", listener);
    return () => window.removeEventListener("efms:dialog", listener);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  function close(result: boolean | string | null) {
    dialog?.resolve(result);
    setDialog(null);
  }

  if (!dialog) return null;
  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(null); }}>
      <div className="dialogCard" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialogIcon">{dialog.mode === "confirm" ? "!" : <Pencil size={20} />}</div>
        <div>
          <h2 id="dialog-title">{dialog.title}</h2>
          <p>{dialog.message}</p>
        </div>
        {dialog.mode === "prompt" && (
          <input autoFocus type={dialog.inputType ?? "text"} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") close(value); }} />
        )}
        <div className="dialogActions">
          <button type="button" className="secondary compact" onClick={() => close(null)}>Cancel</button>
          <button type="button" className={dialog.mode === "confirm" ? "dangerButton compact" : "primary compact"} onClick={() => close(dialog.mode === "confirm" ? true : value)}>{dialog.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function FinanceLoader({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="financeLoaderBackdrop" role="status" aria-live="polite" aria-label="Loading financial data">
      <div className="hLogoLoader">
        <span className="logoMotion" aria-hidden="true"><img src="/assets/htech-logo-transparent.png" alt="" /></span>
        <span className="miniLoaderText">Loading<span>...</span></span>
      </div>
    </div>
  );
}

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "expenses", label: "Expenses", icon: ReceiptText },
  { id: "earnings", label: "Earnings", icon: TrendingUp },
  { id: "bankAccounts", label: "Bank Accounts", icon: Banknote },
  { id: "transfers", label: "Cash/Bank Transfer", icon: ArrowLeftRight },
  { id: "statements", label: "Statements", icon: ClipboardList },
  { id: "reports", label: "Reports & Analytics", icon: TrendingUp },
  { id: "budgets", label: "Budgets", icon: BadgeIndianRupee },
  { id: "reconciliation", label: "Bank Reconciliation", icon: DatabaseBackup },
  { id: "dataSafety", label: "Backup & Restore", icon: DatabaseBackup },
  { id: "vouchers", label: "Vouchers", icon: FileText },
  { id: "employees", label: "Employees", icon: Users },
  { id: "payroll", label: "Payroll", icon: Banknote },
  { id: "roles", label: "Roles & Staff", icon: ShieldCheck },
  { id: "audit", label: "Activity", icon: Activity }
];

const dashboardPermissionOptions = [
  { id: "earnings", label: "Total Earning" },
  { id: "expenses", label: "Total Expense" },
  { id: "todayIncome", label: "Today's Income" },
  { id: "todayExpense", label: "Today's Expense" },
  { id: "bank", label: "Bank Balance" },
  { id: "cash", label: "Cash in Hand" },
  { id: "balance", label: "Total Balance" },
  { id: "vouchers", label: "Total Vouchers" },
  { id: "users", label: "Users" }
];

const actionPermissionGroups = [
  { title: "Expenses", options: [{ id: "expenses.create", label: "Create expense" }, { id: "expenses.edit", label: "Edit expense" }, { id: "expenses.archive", label: "Archive expense" }, { id: "expenses.manage_categories", label: "Manage categories" }] },
  { title: "Earnings", options: [{ id: "earnings.create", label: "Create earning" }, { id: "earnings.edit", label: "Edit earning" }, { id: "earnings.archive", label: "Archive earning" }, { id: "earnings.manage_sources", label: "Manage sources" }, { id: "earnings.manage_projects", label: "Manage projects" }] },
  { title: "Cash/Bank Transfers", options: [{ id: "transfers.create", label: "Create transfer" }, { id: "transfers.edit", label: "Edit transfer" }, { id: "transfers.archive", label: "Archive transfer" }] },
  { title: "Employees", options: [{ id: "employees.create", label: "Create employee" }, { id: "employees.edit", label: "Edit employee" }, { id: "employees.deactivate", label: "Activate/deactivate employee" }] }
  ,{ title: "Payroll", options: [{ id: "payroll.create", label: "Release salary / reimbursement" }] }
];

function canAction(user: User, action: string) {
  return user.role === "super_admin" || Boolean(user.permissions?.actions?.includes(action));
}

function sensitiveFormValue(value?: string) {
  return value === "[encrypted data unavailable]" ? "" : value || "";
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("efms_theme") || "dark");
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: string } | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => setApiLoading((event as CustomEvent<{ active: boolean }>).detail.active);
    window.addEventListener("efms:loading", listener);
    return () => window.removeEventListener("efms:loading", listener);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!getToken() && !await refreshAccessToken()) return;
        const data = await api<{ user: User }>("/auth/me");
        setUser(data.user);
      } catch { clearToken(); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("efms_theme", theme);
  }, [theme]);

  useEffect(() => {
    const listener = (event: Event) => {
      setToast((event as CustomEvent<{ message: string; tone: string }>).detail);
      window.setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("efms:toast", listener);
    return () => window.removeEventListener("efms:toast", listener);
  }, []);

  const visibleNav = user?.role === "super_admin" ? nav : nav.filter((item) => user?.permissions?.sidebar?.includes(item.id));

  useEffect(() => {
    if (user && visibleNav.length > 0 && !visibleNav.some((item) => item.id === view)) {
      setView(visibleNav[0].id);
    }
  }, [user, view, visibleNav.map((item) => item.id).join("|")]);

  if (loading) return <><FinanceLoader visible /><DialogHost /></>;
  if (!user) return <><Login onLogin={setUser} /><FinanceLoader visible={apiLoading} /><DialogHost /></>;

  return (
    <div className="shell">
      <DialogHost />
      <FinanceLoader visible={apiLoading} />
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <img className="brandLogo" src="/assets/htech-logo-transparent.png" alt="Htech logo" />
          <div>
            <strong>EFMS</strong>
            <span>Finance Control</span>
          </div>
        </div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={view === item.id ? "active" : ""} key={item.id} onClick={() => { setView(item.id); setMobileNav(false); }}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <button className="iconButton mobileMenu" onClick={() => setMobileNav((value) => !value)} title="Menu">☰</button>
          <div>
            <span className="eyebrow">Logged in as</span>
            <h1>{user.name}</h1>
          </div>
          <div className="userbox">
            <button
              className="iconButton"
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span>{user.role.replaceAll("_", " ")}</span>
            <button
              className="iconButton"
              onClick={async () => {
                try { await api("/auth/logout", { method: "POST", body: "{}" }); } catch { /* local logout must still complete */ }
                clearToken();
                setUser(null);
              }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {view === "dashboard" && <DashboardView user={user} />}
        {view === "expenses" && <ExpensesView user={user} />}
        {view === "earnings" && <EarningsView user={user} />}
        {view === "bankAccounts" && <BankAccountsView user={user} />}
        {view === "transfers" && <TransfersView user={user} />}
        {view === "statements" && <StatementsView />}
        {view === "reports" && <ReportsView />}
        {view === "budgets" && <BudgetsView user={user} />}
        {view === "reconciliation" && <ReconciliationView user={user} />}
        {view === "dataSafety" && <DataSafetyView user={user} onPasswordChanged={() => { clearToken(); setUser(null); }} />}
        {view === "employees" && <EmployeesView user={user} />}
        {view === "payroll" && <PayrollView user={user} />}
        {view === "roles" && <RolesStaffView user={user} />}
        {view === "vouchers" && <VouchersView user={user} />}
        {view === "invoices" && <InvoicesView user={user} />}
        {view === "cash" && <OperationalModule user={user} config={moduleConfigs.cash} />}
        {view === "bank" && <OperationalModule user={user} config={moduleConfigs.bank} />}
        {view === "refund" && <OperationalModule user={user} config={moduleConfigs.refund} />}
        {view === "salary" && <OperationalModule user={user} config={moduleConfigs.salary} />}
        {view === "document" && <OperationalModule user={user} config={moduleConfigs.document} />}
        {view === "report" && <OperationalModule user={user} config={moduleConfigs.report} />}
        {view === "search" && <SearchView />}
        {view === "setting" && <OperationalModule user={user} config={moduleConfigs.setting} />}
        {view === "users" && <UsersView />}
        {view === "audit" && <ActivityView />}
      </main>
    </div>
  );
}

const moduleConfigs: Record<string, { module: string; eyebrow: string; title: string; action: string; titleLabel: string; amountLabel?: string; fields: string[]; statuses: string[] }> = {
  cash: {
    module: "cash",
    eyebrow: "Cash Tracking",
    title: "Cash book",
    action: "New Cash Entry",
    titleLabel: "Purpose",
    amountLabel: "Amount",
    fields: ["type", "voucherNumber", "doneBy", "approvedBy", "businessDate"],
    statuses: ["received", "spent", "withdrawn", "deposit", "adjustment", "closed", "archived"]
  },
  bank: {
    module: "bank",
    eyebrow: "Bank Management",
    title: "Bank accounts and entries",
    action: "New Bank Entry",
    titleLabel: "Bank / Transaction",
    amountLabel: "Amount",
    fields: ["bankName", "accountNumber", "entryType", "referenceNo", "statementDate"],
    statuses: ["credit", "debit", "transfer", "active", "archived"]
  },
  refund: {
    module: "refund",
    eyebrow: "Employee Refund",
    title: "Refund requests",
    action: "New Refund",
    titleLabel: "Employee / Reason",
    amountLabel: "Refund Amount",
    fields: ["employee", "billReference", "paymentMode", "voucherNumber"],
    statuses: ["requested", "verified", "approved", "paid", "rejected", "archived"]
  },
  salary: {
    module: "salary",
    eyebrow: "Payroll",
    title: "Salary adjustments and advances",
    action: "New Salary Entry",
    titleLabel: "Employee / Salary Item",
    amountLabel: "Amount",
    fields: ["employee", "basicSalary", "expenseAmount", "netSalary", "period", "entryType"],
    statuses: ["adjustment", "advance_requested", "approved", "deducted", "paid", "archived"]
  },
  document: {
    module: "document",
    eyebrow: "Document Management",
    title: "Company documents",
    action: "New Document",
    titleLabel: "Document Name",
    fields: ["folder", "fileType", "expiryDate", "version", "sharedWith"],
    statuses: ["active", "expiring", "expired", "archived"]
  },
  report: {
    module: "report",
    eyebrow: "Reports",
    title: "Report exports",
    action: "New Report Request",
    titleLabel: "Report Name",
    fields: ["reportType", "period", "format", "generatedBy"],
    statuses: ["queued", "generated", "downloaded", "failed", "archived"]
  },
  setting: {
    module: "setting",
    eyebrow: "Configuration",
    title: "Approval and system settings",
    action: "New Setting",
    titleLabel: "Rule / Setting Name",
    amountLabel: "Threshold",
    fields: ["appliesTo", "approverChain", "fromAmount", "toAmount", "value"],
    statuses: ["active", "inactive", "archived"]
  }
};

function OperationalModule({ user, config }: { user: User; config: (typeof moduleConfigs)[string] }) {
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ title: "", amount: "0", status: config.statuses[0], remarks: "" });
  const isSuperAdmin = user.role === "super_admin";
  const visibleFields = config.module === "bank" ? config.fields.filter((field) => !["bankName", "accountNumber"].includes(field)) : config.fields;

  async function load() {
    const [recordData, bankAccountData] = await Promise.all([
      api<OperationalRecord[]>(`/records/${config.module}`),
      config.module === "bank" ? api<BankAccount[]>("/bank-accounts") : Promise.resolve([])
    ]);
    setRecords(recordData);
    setBankAccounts(bankAccountData);
  }

  useEffect(() => {
    load();
  }, [config.module]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const fields = Object.fromEntries(config.fields.map((field) => [field, form[field] || ""]));
    await api(`/records/${config.module}`, {
      method: "POST",
      body: JSON.stringify({
        title: form.title,
        amount: Number(form.amount || 0),
        status: form.status,
        remarks: form.remarks,
        fields
      })
    });
    setForm({ title: "", amount: "0", status: config.statuses[0], remarks: "" });
    setFormOpen(false);
    await load();
  }

  async function editRecord(record: OperationalRecord) {
    const title = await promptPopup(config.titleLabel, record.title, "Edit entry");
    if (title === null) return;
    const amount = config.amountLabel ? await promptPopup(config.amountLabel, String(record.amount), "Edit entry", "number") : String(record.amount);
    if (amount === null) return;
    const remarks = await promptPopup("Remarks", record.remarks || "", "Edit entry");
    if (remarks === null) return;
    await api(`/records/${config.module}/${record._id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, amount: Number(amount), remarks })
    });
    await load();
  }

  async function deleteRecord(record: OperationalRecord) {
    if (!await confirmPopup("Archive this entry?", "Archive entry")) return;
    await api(`/records/${config.module}/${record._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">{config.eyebrow}</span>
          <h2>{config.title}</h2>
        </div>
        <button className="primary compact" onClick={() => setFormOpen((value) => !value)}>
          <Plus size={16} /> {config.action}
        </button>
      </div>
      {formOpen && (
        <form className="formGrid" onSubmit={submit}>
          <label>{config.titleLabel}<input value={form.title || ""} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
          {config.amountLabel && <label>{config.amountLabel}<input type="number" value={form.amount || "0"} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>}
          <label>Status<select value={form.status || config.statuses[0]} onChange={(event) => setForm({ ...form, status: event.target.value })}>{config.statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          {config.module === "bank" && (
            <label>
              Bank Account
              <select
                value={form.accountNumber || ""}
                onChange={(event) => {
                  const account = bankAccounts.find((item) => item.accountNumber === event.target.value);
                  setForm({ ...form, bankName: account?.bankName || "", accountNumber: account?.accountNumber || "", title: account ? `${account.bankName} - ${account.accountNumber}` : form.title });
                }}
                required
              >
                <option value="" disabled>Create bank account first</option>
                {bankAccounts.map((account) => <option key={account._id} value={account.accountNumber}>{account.bankName} - {account.accountNumber}</option>)}
              </select>
            </label>
          )}
          {visibleFields.map((field) => (
            <label key={field}>{field}<input value={form[field] || ""} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>
          ))}
          <label className="wide">Remarks<textarea value={form.remarks || ""} onChange={(event) => setForm({ ...form, remarks: event.target.value })} rows={3} /></label>
          <button className="primary compact">Save Entry</button>
        </form>
      )}
      <SimpleTable
        rows={records}
        columns={["title", "amount", "status", "remarks", ...config.fields.map((field) => `fields.${field}`), "createdAt"]}
        renderActions={isSuperAdmin ? (record) => <RowActions onEdit={() => editRecord(record)} onDelete={() => deleteRecord(record)} deleteTitle="Archive" /> : undefined}
      />
    </section>
  );
}

function SearchView() {
  const [query, setQuery] = useState("");
  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Global Search</span>
          <h2>Search records</h2>
        </div>
      </div>
      <div className="formGrid">
        <label className="wide">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Invoice, voucher, employee, vendor, client, expense, income, document" /></label>
      </div>
      <div className="emptyState">Search UI is ready. Indexed cross-module backend search will be connected after permanent database access is stable. Current query: {query || "none"}</div>
    </section>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(otp ? { otp } : {}) })
      });
      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (message.toLowerCase().includes("authentication code")) setNeedsOtp(true);
      setError(message);
    }
  }

  return (
    <div className="loginPage">
      <div className="loginGlow loginGlowOne" />
      <div className="loginGlow loginGlowTwo" />
      <section className="loginShell">
        <div className="loginShowcase">
          <div className="loginBrand"><span><img src="/assets/htech-logo-transparent.png" alt="Htech logo" /></span><strong>EFMS</strong></div>
          <div className="loginPitch">
            <span className="loginEyebrow">FINANCE, SIMPLIFIED</span>
            <h1>Every rupee.<br /><em>Under control.</em></h1>
            <p>Track expenses, manage cash flow and keep your financial operations secure—all from one workspace.</p>
          </div>
          <div className="loginPreview" aria-hidden="true">
            <div className="loginPreviewTop"><span>Financial overview</span><span className="livePill">● LIVE</span></div>
            <div className="loginMetricGrid">
              <article><span><TrendingUp size={16} /> Income</span><strong>₹ 8.4L</strong><small>↑ 12.8% this month</small></article>
              <article><span><ReceiptText size={16} /> Expenses</span><strong>₹ 3.1L</strong><small>Within monthly budget</small></article>
            </div>
            <div className="loginBars"><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
          <div className="loginTrust"><ShieldCheck size={16} /><span>Protected by secure sessions and role-based access</span></div>
        </div>
        <div className="loginFormSide">
          <form className="loginPanel" onSubmit={submit} autoComplete="off">
            <div className="loginWelcome"><span className="loginMobileBrand"><img src="/assets/htech-logo-transparent.png" alt="Htech logo" /> EFMS</span><h2>Welcome back</h2><p>Enter your credentials to access your account.</p></div>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" placeholder="name@company.com" required /></label>
            {needsOtp && <label>Authenticator code<input inputMode="numeric" pattern="\d{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="Enter 6-digit code" autoFocus /></label>}
            <label>Password<span className="passwordField"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Enter your password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            {error && <p className="loginError"><XCircle size={16} />{error}</p>}
            <button className="primary loginSubmit">Sign in securely <span>→</span></button>
            <p className="loginHelp">Having trouble signing in? Contact your administrator.</p>
          </form>
        </div>
      </section>
    </div>
  );
}

function DashboardView({ user }: { user: User }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeCard, setActiveCard] = useState<DashboardCardId>("earnings");
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api<Dashboard>("/dashboard").then(setData);
    Promise.all([
      api<Earning[]>("/earnings"),
      api<Expense[]>("/expenses"),
      api<Voucher[]>("/vouchers"),
      api<BankAccount[]>("/bank-accounts"),
      api<User[]>("/users")
    ]).then(([earningData, expenseData, voucherData, bankData, userData]) => {
      setEarnings(earningData);
      setExpenses(expenseData);
      setVouchers(voucherData);
      setBankAccounts(bankData);
      setUsers(userData);
    });
  }, []);

  const cards = [
    { id: "earnings" as const, label: "Total Earning", value: rupee(data?.totalIncome ?? 0), icon: TrendingUp },
    { id: "expenses" as const, label: "Total Expense", value: rupee(data?.totalExpense ?? 0), icon: ReceiptText },
    { id: "todayIncome" as const, label: "Today's Income", value: rupee(data?.todayIncome ?? 0), icon: TrendingUp },
    { id: "todayExpense" as const, label: "Today's Expense", value: rupee(data?.todayExpense ?? 0), icon: ReceiptText },
    { id: "bank" as const, label: "Bank Balance", value: rupee(data?.bankBalance ?? 0), icon: Banknote },
    { id: "cash" as const, label: "Cash in Hand", value: rupee(data?.cashInHand ?? 0), icon: Banknote },
    { id: "balance" as const, label: "Total Balance", value: rupee(data?.totalBalance ?? ((data?.bankBalance ?? 0) + (data?.cashInHand ?? 0))), icon: Banknote },
    { id: "vouchers" as const, label: "Total Vouchers", value: data?.vouchers ?? 0, icon: FileText },
    { id: "users" as const, label: "Users", value: data?.users ?? 0, icon: Users }
  ];
  const visibleCards = user.role === "super_admin" ? cards : cards.filter((card) => user.permissions?.dashboard?.includes(card.id));

  useEffect(() => {
    if (visibleCards.length > 0 && !visibleCards.some((card) => card.id === activeCard)) {
      setActiveCard(visibleCards[0].id);
    }
  }, [visibleCards.map((card) => card.id).join("|"), activeCard]);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>Finance dashboard</h2>
        </div>
      </div>
      <div className="metricGrid">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              className={`metric ${activeCard === card.id ? "active" : ""}`}
              key={card.label}
              type="button"
              onClick={() => {
                setActiveCard(card.id);
                setPage(1);
              }}
            >
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </button>
          );
        })}
      </div>
      <DashboardBreakdown
        activeCard={activeCard}
        filters={filters}
        setFilters={(next) => {
          setFilters(next);
          setPage(1);
        }}
        page={page}
        setPage={setPage}
        earnings={earnings}
        expenses={expenses}
        vouchers={vouchers}
        bankAccounts={bankAccounts}
        users={users}
      />
    </section>
  );
}

function DashboardBreakdown({
  activeCard,
  filters,
  setFilters,
  page,
  setPage,
  earnings,
  expenses,
  vouchers,
  bankAccounts,
  users
}: {
  activeCard: DashboardCardId;
  filters: { from: string; to: string };
  setFilters: (filters: { from: string; to: string }) => void;
  page: number;
  setPage: (page: number) => void;
  earnings: Earning[];
  expenses: Expense[];
  vouchers: Voucher[];
  bankAccounts: BankAccount[];
  users: User[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dateFilter = activeCard === "todayIncome" || activeCard === "todayExpense" ? { from: today, to: today } : filters;
  const filteredEarnings = earnings.filter((earning) => earning.status !== "archived" && withinDateRange(earning.createdAt, dateFilter.from, dateFilter.to));
  const filteredExpenses = expenses.filter((expense) => expense.status !== "archived" && withinDateRange(expense.createdAt, dateFilter.from, dateFilter.to));
  const filteredVouchers = vouchers.filter((voucher) => withinDateRange(voucher.createdAt, dateFilter.from, dateFilter.to));
  const filteredUsers = users.filter((user) => withinDateRange(user.createdAt || "", dateFilter.from, dateFilter.to));
  const cashEarnings = filteredEarnings.filter((earning) => earning.paymentMode === "cash");
  const bankEarnings = filteredEarnings.filter((earning) => earning.paymentMode !== "cash");
  const cashExpenses = filteredExpenses.filter((expense) => expense.paidFrom === "office" && expense.paymentMode === "cash");
  const bankExpenses = filteredExpenses.filter((expense) => expense.paidFrom === "office" && expense.paymentMode === "bank");
  const employeeExpenses = filteredExpenses.filter((expense) => expense.paidFrom === "employee");
  const cashVouchers = filteredVouchers.filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode === "cash");
  const bankVouchers = filteredVouchers.filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode === "bank");

  const rowsByCard: Record<DashboardCardId, Array<Record<string, unknown>>> = {
    earnings: filteredEarnings,
    expenses: filteredExpenses,
    todayIncome: filteredEarnings,
    todayExpense: filteredExpenses,
    bank: [
      ...bankAccounts.map((account) => ({ type: "Opening/Current Bank", name: `${account.bankName} - ${account.accountNumber}`, amount: account.currentBalance })),
      ...bankEarnings.map((earning) => ({ type: "Earning", name: earning.customer, mode: earning.paymentMode, bank: earning.bankAccount, amount: earning.paidAmount, date: earning.createdAt })),
      ...bankExpenses.map((expense) => ({ type: "Expense", name: expense.purpose, mode: expense.paymentMode, bank: expense.bankAccount, amount: -expense.amount, date: expense.createdAt })),
      ...bankVouchers.map((voucher) => ({ type: "Voucher Payment", name: voucher.purpose, mode: voucher.paymentMode, bank: voucher.bankAccount, amount: -voucher.amount, date: voucher.createdAt }))
    ],
    cash: [
      ...cashEarnings.map((earning) => ({ type: "Cash Earning", name: earning.customer, amount: earning.paidAmount, date: earning.createdAt })),
      ...cashExpenses.map((expense) => ({ type: "Cash Expense", name: expense.purpose, amount: -expense.amount, date: expense.createdAt })),
      ...cashVouchers.map((voucher) => ({ type: "Voucher Payment", name: voucher.purpose, amount: -voucher.amount, date: voucher.createdAt }))
    ],
    balance: [
      { type: "Bank Balance", name: "Bank accounts + bank earnings - bank expenses - bank vouchers", amount: sumRows(bankAccounts, "currentBalance") + sumRows(bankEarnings, "paidAmount") - sumRows(bankExpenses, "amount") - sumRows(bankVouchers, "amount") },
      { type: "Cash in Hand", name: "Cash earnings - cash expenses - cash vouchers", amount: sumRows(cashEarnings, "paidAmount") - sumRows(cashExpenses, "amount") - sumRows(cashVouchers, "amount") },
      { type: "Employee Paid Expenses", name: "Payable to employees, no cash/bank impact", amount: sumRows(employeeExpenses, "amount") }
    ],
    vouchers: filteredVouchers,
    users: filteredUsers
  };

  const titleByCard: Record<DashboardCardId, string> = {
    earnings: "Total Earning Bifurcation",
    expenses: "Total Expense Bifurcation",
    todayIncome: "Today's Income Bifurcation",
    todayExpense: "Today's Expense Bifurcation",
    bank: "Bank Balance Bifurcation",
    cash: "Cash in Hand Bifurcation",
    balance: "Total Balance Bifurcation",
    vouchers: "Voucher Bifurcation",
    users: "User Bifurcation"
  };

  const columnsByCard: Record<DashboardCardId, string[]> = {
    earnings: ["source", "project", "customer", "paymentMode", "bankAccount", "paidAmount", "createdAt"],
    expenses: ["purpose", "category", "amount", "paidFrom", "paymentMode", "bankAccount", "spentByEmployeeName", "createdAt"],
    todayIncome: ["source", "project", "customer", "paymentMode", "bankAccount", "paidAmount", "createdAt"],
    todayExpense: ["purpose", "category", "amount", "paidFrom", "paymentMode", "bankAccount", "spentByEmployeeName", "createdAt"],
    bank: ["type", "name", "mode", "bank", "amount", "date"],
    cash: ["type", "name", "amount", "date"],
    balance: ["type", "name", "amount"],
    vouchers: ["voucherNumber", "type", "receiver", "purpose", "amount", "paymentMode", "createdAt"],
    users: ["name", "email", "role", "isActive", "createdAt"]
  };

  const rows = rowsByCard[activeCard];
  const pagedRows = paginateRows(rows, page);

  return (
    <section className="breakdownPanel">
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Bifurcation</span>
          <h2>{titleByCard[activeCard]}</h2>
        </div>
      </div>
      <FilterBar>
        <label>From Date<input type="date" value={dateFilter.from} disabled={activeCard === "todayIncome" || activeCard === "todayExpense"} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>To Date<input type="date" value={dateFilter.to} disabled={activeCard === "todayIncome" || activeCard === "todayExpense"} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      </FilterBar>
      <SimpleTable rows={pagedRows} columns={columnsByCard[activeCard]} />
      <Pagination page={page} total={rows.length} onPage={setPage} />
    </section>
  );
}

function EarningsView({ user }: { user: User }) {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [sources, setSources] = useState<MasterOption[]>([]);
  const [projects, setProjects] = useState<MasterOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEarning, setEditingEarning] = useState<Earning | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", paymentMode: "" });
  const [page, setPage] = useState(1);
  const isSuperAdmin = user.role === "super_admin";
  const canCreate = canAction(user, "earnings.create");
  const canEdit = canAction(user, "earnings.edit");
  const canArchive = canAction(user, "earnings.archive");

  async function load() {
    const [earningData, sourceData, projectData, bankAccountData] = await Promise.all([
      api<Earning[]>("/earnings"),
      api<MasterOption[]>("/options/earning_source"),
      api<MasterOption[]>("/options/project"),
      api<BankAccount[]>("/bank-accounts")
    ]);
    setEarnings(earningData);
    setSources(sourceData);
    setProjects(projectData);
    setBankAccounts(bankAccountData);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteEarning(earning: Earning) {
    if (!await confirmPopup("Archive this earning entry?", "Archive earning")) return;
    await api(`/earnings/${earning._id}`, { method: "DELETE" });
    await load();
  }

  const filteredEarnings = earnings.filter((earning) => withinDateRange(earning.createdAt, filters.from, filters.to) && (!filters.paymentMode || earning.paymentMode === filters.paymentMode));
  const pagedEarnings = paginateRows(filteredEarnings, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Income</span>
          <h2>Earning entries</h2>
        </div>
        {canCreate && <button
          className="primary compact"
          onClick={() => {
            setEditingEarning(null);
            setFormOpen((value) => !value);
          }}
        >
          <Plus size={16} /> New Earning
        </button>}
      </div>
      <MasterOptionManager title="Earning Sources" type="earning_source" options={sources} onChanged={load} canManage={canAction(user, "earnings.manage_sources")} />
      <MasterOptionManager title="Projects" type="project" options={projects} onChanged={load} canManage={canAction(user, "earnings.manage_projects")} />
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
        <label>
          Payment Mode
          <select value={filters.paymentMode} onChange={(event) => { setFilters({ ...filters, paymentMode: event.target.value }); setPage(1); }}>
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </label>
      </FilterBar>
      {formOpen && (
        <EarningForm
          sources={sources}
          projects={projects}
          bankAccounts={bankAccounts}
          initialEarning={editingEarning}
          onCancel={() => {
            setEditingEarning(null);
            setFormOpen(false);
          }}
          onSaved={() => {
            setEditingEarning(null);
            setFormOpen(false);
            load();
          }}
        />
      )}
      <SimpleTable
        rows={pagedEarnings}
        columns={["source", "project", "customer", "paymentMode", "paidAmount", "remarks", "status"]}
        renderActions={
          canEdit || canArchive
            ? (earning) => <RowActions onEdit={canEdit ? () => { setEditingEarning(earning); setFormOpen(true); } : undefined} onDelete={canArchive ? () => deleteEarning(earning) : undefined} deleteTitle="Archive" />
            : undefined
        }
      />
      <Pagination page={page} total={filteredEarnings.length} onPage={setPage} />
    </section>
  );
}

function EarningForm({
  sources,
  projects,
  bankAccounts,
  initialEarning,
  onSaved,
  onCancel
}: {
  sources: MasterOption[];
  projects: MasterOption[];
  bankAccounts: BankAccount[];
  initialEarning: Earning | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    source: initialEarning?.source || sources[0]?.name || "",
    project: initialEarning?.project || "",
    customer: initialEarning?.customer || "",
    paymentMode: initialEarning?.paymentMode || "bank",
    bankAccount: initialEarning?.bankAccount || "",
    referenceNo: initialEarning?.referenceNo || "",
    remarks: initialEarning?.remarks || "",
    paidAmount: initialEarning?.paidAmount || 0
  });

  useEffect(() => {
    if (!form.source && sources[0]) setForm((current) => ({ ...current, source: sources[0].name }));
  }, [sources]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(initialEarning ? `/earnings/${initialEarning._id}` : "/earnings", {
      method: initialEarning ? "PATCH" : "POST",
      body: JSON.stringify({ ...form, amount: form.paidAmount, gstApplicable: false, gstRate: 0 })
    });
    onSaved();
  }

  return (
    <form className="formGrid" onSubmit={submit}>
      <label>
        Source
        <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required>
          <option value="" disabled>Create source first</option>
          {sources.map((source) => <option key={source._id} value={source.name}>{source.name}</option>)}
        </select>
      </label>
      <label>
        Select Project
        <select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>
          <option value="">No project</option>
          {projects.map((project) => <option key={project._id} value={project.name}>{project.name}</option>)}
        </select>
      </label>
      <label>Customer<input value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} required /></label>
      <label>
        Payment Mode
        <select
          value={form.paymentMode}
          onChange={(event) => setForm({ ...form, paymentMode: event.target.value, bankAccount: event.target.value === "cash" ? "" : form.bankAccount })}
        >
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
      </label>
      {form.paymentMode !== "cash" && (
        <label>
          Bank Account
          <select value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} required>
            <option value="" disabled>Create bank account first</option>
            {bankAccounts.filter((account) => account.isActive !== false).map((account) => {
              const label = `${account.bankName} - ${account.accountNumber}`;
              return <option key={account._id} value={label}>{label}</option>;
            })}
          </select>
        </label>
      )}
      <label>Reference No.<input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} /></label>
      <label>Paid Amount<input type="number" value={form.paidAmount} onChange={(event) => setForm({ ...form, paidAmount: Number(event.target.value) })} /></label>
      <label className="wide">Remarks<textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} rows={3} /></label>
      <div className="formActions">
        <button className="primary compact">{initialEarning ? "Update Earning" : "Save Earning"}</button>
        <button className="secondary compact" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function BankAccountsView({ user }: { user: User }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ bankName: "", accountNumber: "", currentBalance: 0 });
  const [filters, setFilters] = useState({ from: "", to: "", status: "" });
  const [page, setPage] = useState(1);
  const isSuperAdmin = user.role === "super_admin";

  async function load() {
    setAccounts(await api<BankAccount[]>("/bank-accounts"));
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(account: BankAccount) {
    setEditingAccount(account);
    setForm({ bankName: account.bankName, accountNumber: account.accountNumber, currentBalance: account.openingBalance ?? account.currentBalance });
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(editingAccount ? `/bank-accounts/${editingAccount._id}` : "/bank-accounts", {
      method: editingAccount ? "PATCH" : "POST",
      body: JSON.stringify(form)
    });
    setEditingAccount(null);
    setForm({ bankName: "", accountNumber: "", currentBalance: 0 });
    setFormOpen(false);
    await load();
  }

  async function deleteAccount(account: BankAccount) {
    if (!await confirmPopup(`Delete ${account.bankName}? This is allowed only when the account has no transaction history.`, "Delete bank account", "Delete")) return;
    await api(`/bank-accounts/${account._id}`, { method: "DELETE" });
    await load();
  }

  async function setBankActive(account: BankAccount, isActive: boolean) {
    await api(`/bank-accounts/${account._id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    await load();
  }

  const filteredAccounts = accounts.filter((account) => {
    const statusOk = !filters.status || (filters.status === "active" ? account.isActive !== false : account.isActive === false);
    return statusOk && withinDateRange(account.createdAt, filters.from, filters.to);
  });
  const pagedAccounts = paginateRows(filteredAccounts, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Accounts</span>
          <h2>Bank Accounts</h2>
        </div>
        {isSuperAdmin && <button className="primary compact" onClick={() => { if (formOpen && !editingAccount) { setFormOpen(false); } else { setEditingAccount(null); setForm({ bankName: "", accountNumber: "", currentBalance: 0 }); setFormOpen(true); } }}><Plus size={16} /> {formOpen && !editingAccount ? "Close Form" : "Create Bank"}</button>}
      </div>
      {formOpen && <form className="formGrid" onSubmit={submit}>
        <label>Bank Name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} required /></label>
        <label>Account Number<input value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} required /></label>
        <label>Opening Balance<input type="number" value={form.currentBalance} onChange={(event) => setForm({ ...form, currentBalance: Number(event.target.value) })} /></label>
        <div className="formActions">
          <button className="primary compact">{editingAccount ? "Update Account" : "Create Account"}</button>
          <button className="secondary compact" type="button" onClick={() => { setEditingAccount(null); setForm({ bankName: "", accountNumber: "", currentBalance: 0 }); setFormOpen(false); }}>Cancel</button>
        </div>
      </form>}
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Deactive</option>
          </select>
        </label>
      </FilterBar>
      <SimpleTable
        rows={pagedAccounts}
        columns={["bankName", "accountNumber", "currentBalance", "isActive"]}
        moneyColumn="currentBalance"
        renderActions={isSuperAdmin ? (account) => (
          <>
            <button className="iconButton" onClick={() => startEdit(account)} title="Edit"><Pencil size={16} /></button>
            {account.isActive === false ? (
              <button className="iconButton good" onClick={() => setBankActive(account, true)} title="Activate"><CheckCircle2 size={16} /></button>
            ) : (
              <button className="iconButton bad" onClick={() => setBankActive(account, false)} title="Deactivate"><XCircle size={16} /></button>
            )}
            <button className="iconButton bad" onClick={() => deleteAccount(account)} title="Delete if unused"><Trash2 size={16} /></button>
          </>
        ) : undefined}
      />
      <Pagination page={page} total={filteredAccounts.length} onPage={setPage} />
    </section>
  );
}

function TransfersView({ user }: { user: User }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [form, setForm] = useState({ type: "cash_to_bank", amount: 0, bankAccount: "", referenceNo: "", remarks: "", transferDate: new Date().toISOString().slice(0, 10) });
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const canCreate = canAction(user, "transfers.create");
  const canEdit = canAction(user, "transfers.edit");
  const canArchive = canAction(user, "transfers.archive");

  async function load() {
    const [transferData, accountData] = await Promise.all([api<Transfer[]>("/transfers"), api<BankAccount[]>("/bank-accounts")]);
    setTransfers(transferData);
    setBankAccounts(accountData);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingTransfer(null);
    setForm({ type: "cash_to_bank", amount: 0, bankAccount: "", referenceNo: "", remarks: "", transferDate: new Date().toISOString().slice(0, 10) });
  }

  function startEdit(transfer: Transfer) {
    setEditingTransfer(transfer);
    setForm({
      type: transfer.type,
      amount: transfer.amount,
      bankAccount: transfer.bankAccount,
      referenceNo: transfer.referenceNo || "",
      remarks: transfer.remarks || "",
      transferDate: toDateInputValue(transfer.transferDate)
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(editingTransfer ? `/transfers/${editingTransfer._id}` : "/transfers", {
      method: editingTransfer ? "PATCH" : "POST",
      body: JSON.stringify(form)
    });
    resetForm();
    await load();
  }

  async function deleteTransfer(transfer: Transfer) {
    if (!await confirmPopup("Archive this transfer?", "Archive transfer")) return;
    await api(`/transfers/${transfer._id}`, { method: "DELETE" });
    await load();
  }

  const filteredTransfers = transfers.filter((transfer) => withinDateRange(transfer.transferDate, filters.from, filters.to));
  const pagedTransfers = paginateRows(filteredTransfers, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Internal Movement</span>
          <h2>Cash/Bank Transfer</h2>
        </div>
      </div>
      {(canCreate || Boolean(editingTransfer && canEdit)) && (
        <form className="formGrid" onSubmit={submit}>
          <label>
            Transfer Type
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="cash_to_bank">Cash to Bank</option>
              <option value="bank_to_cash">Bank to Cash</option>
            </select>
          </label>
          <label>
            Bank Account
            <select value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} required>
              <option value="" disabled>Select bank</option>
              {bankAccounts.filter((account) => account.isActive !== false).map((account) => {
                const label = `${account.bankName} - ${account.accountNumber}`;
                return <option key={account._id} value={label}>{label}</option>;
              })}
            </select>
          </label>
          <label>Amount<input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label>
          <label>Date<input type="date" value={form.transferDate} onChange={(event) => setForm({ ...form, transferDate: event.target.value })} required /></label>
          <label>Reference No.<input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} /></label>
          <label className="wide">Remarks<textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} rows={3} /></label>
          <div className="formActions">
            <button className="primary compact">{editingTransfer ? "Update Transfer" : "Create Transfer"}</button>
            {editingTransfer && <button className="secondary compact" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      )}
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
      </FilterBar>
      <SimpleTable
        rows={pagedTransfers}
        columns={["type", "bankAccount", "amount", "referenceNo", "remarks", "transferDate"]}
        renderActions={canEdit || canArchive ? (transfer) => <RowActions onEdit={canEdit ? () => startEdit(transfer) : undefined} onDelete={canArchive ? () => deleteTransfer(transfer) : undefined} deleteTitle="Archive" /> : undefined}
      />
      <Pagination page={page} total={filteredTransfers.length} onPage={setPage} />
    </section>
  );
}

function StatementsView() {
  const [statementType, setStatementType] = useState<"bank" | "cash">("bank");
  const [bankAccount, setBankAccount] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    Promise.all([api<Earning[]>("/earnings"), api<Expense[]>("/expenses"), api<Transfer[]>("/transfers"), api<Voucher[]>("/vouchers"), api<BankAccount[]>("/bank-accounts"), api<Payroll[]>("/payroll")]).then(([earningData, expenseData, transferData, voucherData, accountData, payrollData]) => {
      setEarnings(earningData);
      setExpenses(expenseData);
      setTransfers(transferData);
      setVouchers(voucherData);
      setBankAccounts(accountData);
      setPayrolls(payrollData);
    });
  }, []);

  const bankRows = [
    ...earnings.filter((earning) => earning.status !== "archived" && earning.paymentMode !== "cash").map((earning) => ({ date: earning.createdAt, timestamp: earning.createdAt, type: "Earning", bankAccount: earning.bankAccount || "Unlinked Bank", particulars: earning.customer, credit: earning.paidAmount, debit: 0, referenceNo: earning.referenceNo || "", remarks: earning.remarks || "" })),
    ...expenses.filter((expense) => expense.status !== "archived" && expense.paidFrom === "office" && expense.paymentMode === "bank").map((expense) => ({ date: expense.createdAt, timestamp: expense.createdAt, type: "Expense", bankAccount: expense.bankAccount || "Unlinked Bank", particulars: expense.purpose, credit: 0, debit: expense.amount, referenceNo: "", remarks: expense.remarks || "" })),
    ...transfers.filter((transfer) => transfer.status !== "archived").map((transfer) => ({ date: transfer.transferDate, timestamp: transfer.createdAt, type: transfer.type === "cash_to_bank" ? "Cash Deposit" : "Cash Withdrawal", bankAccount: transfer.bankAccount, particulars: transfer.type === "cash_to_bank" ? "Cash to Bank" : "Bank to Cash", credit: transfer.type === "cash_to_bank" ? transfer.amount : 0, debit: transfer.type === "bank_to_cash" ? transfer.amount : 0, referenceNo: transfer.referenceNo || "", remarks: transfer.remarks || "" })),
    ...vouchers.filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode === "bank").map((voucher) => ({ date: voucher.createdAt, timestamp: voucher.createdAt, type: "Voucher Payment", bankAccount: voucher.bankAccount || "Unlinked Bank", particulars: voucher.purpose, credit: 0, debit: voucher.amount, referenceNo: voucher.referenceNo || voucher.voucherNumber, remarks: voucher.receiver || "" })),
    ...payrolls.filter((payroll) => payroll.status === "paid" && payroll.paymentMode === "bank").map((payroll) => ({ date: payroll.paymentDate, timestamp: payroll.paymentDate, type: "Salary Payment", bankAccount: payroll.bankAccount || "Unlinked Bank", particulars: `${payroll.employeeId?.name || "Employee"} - Salary ${payroll.salaryMonth}`, credit: 0, debit: payroll.totalPaid, referenceNo: payroll.referenceNo || payroll.payrollNumber, remarks: payroll.includeExpenses ? `Salary + reimbursement ${rupee(payroll.reimbursementAmount)}` : "Salary only" }))
  ];

  const cashRows = [
    ...earnings.filter((earning) => earning.status !== "archived" && earning.paymentMode === "cash").map((earning) => ({ date: earning.createdAt, timestamp: earning.createdAt, type: "Cash Earning", particulars: earning.customer, credit: earning.paidAmount, debit: 0, referenceNo: earning.referenceNo || "", remarks: earning.remarks || "" })),
    ...expenses.filter((expense) => expense.status !== "archived" && expense.paidFrom === "office" && expense.paymentMode === "cash").map((expense) => ({ date: expense.createdAt, timestamp: expense.createdAt, type: "Cash Expense", particulars: expense.purpose, credit: 0, debit: expense.amount, referenceNo: "", remarks: expense.remarks || "" })),
    ...transfers.filter((transfer) => transfer.status !== "archived").map((transfer) => ({ date: transfer.transferDate, timestamp: transfer.createdAt, type: transfer.type === "cash_to_bank" ? "Cash Deposit to Bank" : "Cash Withdrawal from Bank", particulars: transfer.bankAccount, credit: transfer.type === "bank_to_cash" ? transfer.amount : 0, debit: transfer.type === "cash_to_bank" ? transfer.amount : 0, referenceNo: transfer.referenceNo || "", remarks: transfer.remarks || "" })),
    ...vouchers.filter((voucher) => voucher.status === "issued" && voucher.type !== "receipt" && voucher.paymentMode === "cash").map((voucher) => ({ date: voucher.createdAt, timestamp: voucher.createdAt, type: "Voucher Payment", particulars: voucher.purpose, credit: 0, debit: voucher.amount, referenceNo: voucher.referenceNo || voucher.voucherNumber, remarks: voucher.receiver || "" })),
    ...payrolls.filter((payroll) => payroll.status === "paid" && payroll.paymentMode === "cash").map((payroll) => ({ date: payroll.paymentDate, timestamp: payroll.paymentDate, type: "Salary Payment", particulars: `${payroll.employeeId?.name || "Employee"} - Salary ${payroll.salaryMonth}`, credit: 0, debit: payroll.totalPaid, referenceNo: payroll.referenceNo || payroll.payrollNumber, remarks: payroll.includeExpenses ? `Salary + reimbursement ${rupee(payroll.reimbursementAmount)}` : "Salary only" }))
  ];

  const rows = (statementType === "bank" ? bankRows.filter((row) => !bankAccount || row.bankAccount === bankAccount) : cashRows)
    .filter((row) => withinDateRange(row.date, filters.from, filters.to))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const pagedRows = paginateRows(rows, page);
  const totalCredit = sumRows(rows, "credit");
  const totalDebit = sumRows(rows, "debit");

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Ledger</span>
          <h2>Statements</h2>
        </div>
      </div>
      <FilterBar>
        <label>
          Statement Type
          <select value={statementType} onChange={(event) => { setStatementType(event.target.value as "bank" | "cash"); setBankAccount(""); setPage(1); }}>
            <option value="bank">Bank Statement</option>
            <option value="cash">Cash Statement</option>
          </select>
        </label>
        {statementType === "bank" && (
          <label>
            Bank Name
            <select value={bankAccount} onChange={(event) => { setBankAccount(event.target.value); setPage(1); }}>
              <option value="">All Banks</option>
              {bankAccounts.map((account) => {
                const label = `${account.bankName} - ${account.accountNumber}`;
                return <option key={account._id} value={label}>{label}</option>;
              })}
            </select>
          </label>
        )}
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
      </FilterBar>
      <div className="summaryStrip">
        <strong>Credit: {rupee(totalCredit)}</strong>
        <strong>Debit: {rupee(totalDebit)}</strong>
        <strong>Net: {rupee(totalCredit - totalDebit)}</strong>
      </div>
      <SimpleTable rows={pagedRows} columns={statementType === "bank" ? ["date", "timestamp", "type", "bankAccount", "particulars", "credit", "debit", "referenceNo", "remarks"] : ["date", "timestamp", "type", "particulars", "credit", "debit", "referenceNo", "remarks"]} />
      <Pagination page={page} total={rows.length} onPage={setPage} />
    </section>
  );
}

type Analytics = {
  totals: { income: number; expense: number; profit: number };
  monthly: Array<{ month: string; income: number; expense: number; net: number }>;
  categoryExpenses: Array<{ name: string; amount: number }>;
  employeeExpenses: Array<{ name: string; amount: number }>;
  vendorExpenses: Array<{ name: string; amount: number }>;
};

function ReportsView() {
  const now = new Date();
  const [filters, setFilters] = useState({ from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) });
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams(filters).toString();
  useEffect(() => {
    setLoading(true);
    api<Analytics>(`/analytics/summary?${query}`).then(setData).finally(() => setLoading(false));
  }, [query]);
  const max = Math.max(1, ...(data?.monthly.flatMap((item) => [item.income, item.expense]) ?? [1]));
  async function download(format: "csv" | "excel" | "pdf") {
    const blob = await apiBlob(format === "pdf" ? `/analytics/pdf?${query}` : `/analytics/export?${query}&format=${format}`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `efms-report.${format === "csv" ? "csv" : format === "pdf" ? "pdf" : "xls"}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return <section>
    <div className="sectionHead"><div><span className="eyebrow">Financial intelligence</span><h2>Reports & Analytics</h2></div><div className="buttonRow"><button className="secondary compact" onClick={() => download("csv")}>CSV</button><button className="secondary compact" onClick={() => download("excel")}>Excel</button><button className="primary compact" onClick={() => download("pdf")}><Download size={16} /> Download PDF</button></div></div>
    <FilterBar><label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label><label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label></FilterBar>
    {loading || !data ? <div className="skeletonGrid"><i /><i /><i /></div> : <>
      <div className="cards three"><article className="card"><span>Income</span><strong>{rupee(data.totals.income)}</strong></article><article className="card"><span>Expense</span><strong>{rupee(data.totals.expense)}</strong></article><article className="card"><span>Net P&amp;L</span><strong className={data.totals.profit < 0 ? "dangerText" : "successText"}>{rupee(data.totals.profit)}</strong></article></div>
      <div className="analyticsGrid">
        <article className="chartPanel"><h3>Monthly cash flow</h3><div className="barChart">{data.monthly.map((item) => <div className="barGroup" key={item.month}><div><i className="incomeBar" style={{ height: `${Math.max(3, item.income / max * 180)}px` }} title={`Income ${rupee(item.income)}`} /><i className="expenseBar" style={{ height: `${Math.max(3, item.expense / max * 180)}px` }} title={`Expense ${rupee(item.expense)}`} /></div><small>{item.month.slice(5)}</small></div>)}</div><div className="chartLegend"><span>● Income</span><span>● Expense</span></div></article>
        <RankedReport title="Category-wise expenses" rows={data.categoryExpenses} />
        <RankedReport title="Employee-wise expenses" rows={data.employeeExpenses} />
        <RankedReport title="Vendor-wise expenses" rows={data.vendorExpenses} />
      </div>
    </>}
  </section>;
}

function RankedReport({ title, rows }: { title: string; rows: Array<{ name: string; amount: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return <article className="chartPanel"><h3>{title}</h3>{rows.slice(0, 8).map((row) => <div className="rankRow" key={row.name}><span>{row.name}</span><div><i style={{ width: `${row.amount / max * 100}%` }} /></div><strong>{rupee(row.amount)}</strong></div>)}{!rows.length && <p className="muted">No records in this period.</p>}</article>;
}

function BudgetsView({ user }: { user: User }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", month: new Date().toISOString().slice(0, 7), category: "", department: "", limit: 0 });
  const load = () => api<Budget[]>("/budgets").then(setBudgets);
  useEffect(() => { load(); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/budgets", { method: "POST", body: JSON.stringify(form) });
    setOpen(false); setForm({ ...form, name: "", limit: 0 }); await load();
  }
  return <section><div className="sectionHead"><div><span className="eyebrow">Spend control</span><h2>Monthly budgets</h2></div>{user.role === "super_admin" && <button className="primary compact" onClick={() => setOpen(!open)}><Plus size={16} /> New Budget</button>}</div>
    {open && <form className="formGrid" onSubmit={submit}><label>Name<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Month<input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></label><label>Category (optional)<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label>Department (optional)<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label><label>Limit<input type="number" min="1" required value={form.limit} onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })} /></label><button className="primary compact">Save Budget</button></form>}
    <div className="budgetGrid">{budgets.map((budget) => <article className={`budgetCard ${budget.alert}`} key={budget._id}><div><span>{budget.month}</span><strong>{budget.name}</strong><small>{[budget.department, budget.category].filter(Boolean).join(" · ") || "Company-wide"}</small></div><div className="progress"><i style={{ width: `${Math.min(100, budget.utilization)}%` }} /></div><div className="budgetNumbers"><span>{rupee(budget.spent)} spent</span><strong>{budget.utilization}%</strong><span>{rupee(budget.limit)} limit</span></div>{budget.alert !== "ok" && <p className="budgetAlert">{budget.alert === "exceeded" ? "Budget exceeded" : "80% budget warning"}</p>}</article>)}</div>
  </section>;
}

function ReconciliationView({ user }: { user: User }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [account, setAccount] = useState("");
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [message, setMessage] = useState("");
  const load = (id = account) => api<StatementEntry[]>(`/reconciliation${id ? `?bankAccount=${id}` : ""}`).then(setEntries);
  useEffect(() => { api<BankAccount[]>("/bank-accounts").then((items) => { setAccounts(items); if (items[0]) setAccount(items[0]._id); }); }, []);
  useEffect(() => { if (account) load(account); }, [account]);
  async function importCsv(file?: File) {
    if (!file || !account) return;
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = lines.shift()!.split(",").map((x) => x.trim().toLowerCase());
    const entries = lines.map((line) => { const cells = line.split(",").map((x) => x.trim().replace(/^"|"$/g, "")); const get = (name: string) => cells[headers.indexOf(name)] || ""; return { date: get("date"), description: get("description"), reference: get("reference"), debit: Number(get("debit") || 0), credit: Number(get("credit") || 0), balance: get("balance") ? Number(get("balance")) : undefined }; });
    const result = await api<{ imported: number; duplicates: number }>("/reconciliation/import", { method: "POST", body: JSON.stringify({ bankAccount: account, entries }) });
    setMessage(`${result.imported} imported, ${result.duplicates} duplicates skipped`); await load();
  }
  return <section><div className="sectionHead"><div><span className="eyebrow">Bank control</span><h2>Reconciliation</h2></div>{user.role === "super_admin" && <label className="primary compact fileButton">Import CSV<input type="file" accept=".csv" onChange={(e) => importCsv(e.target.files?.[0])} /></label>}</div>
    <FilterBar><label>Bank account<select value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((x) => <option key={x._id} value={x._id}>{x.bankName} - {x.accountNumber}</option>)}</select></label><span className="muted">CSV columns: date, description, reference, debit, credit, balance</span></FilterBar>{message && <p className="successBox">{message}</p>}
    <div className="summaryStrip"><strong>Imported: {entries.length}</strong><strong>Matched: {entries.filter((x) => x.matchType).length}</strong><strong>Unmatched: {entries.filter((x) => !x.matchType).length}</strong></div>
    <SimpleTable rows={entries} columns={["transactionDate", "description", "reference", "debit", "credit", "balance", "matchType"]} />
  </section>;
}

function DataSafetyView({ user, onPasswordChanged }: { user: User; onPasswordChanged: () => void }) {
  const [message, setMessage] = useState("");
  const [twoFactor, setTwoFactor] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpRecipient, setPasswordOtpRecipient] = useState("");
  if (user.role !== "super_admin") return <div className="emptyState">Only Super Admin can access backups.</div>;
  async function backup() {
    const url = URL.createObjectURL(await apiBlob("/data-safety/backup"));
    const link = document.createElement("a"); link.href = url; link.download = `efms-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    setMessage("Encrypted transport backup downloaded successfully.");
  }
  async function restore(file?: File) {
    if (!file) return;
    const confirmation = await promptPopup('Type "RESTORE EFMS" to continue.', "", "Confirm database restore");
    if (confirmation !== "RESTORE EFMS") return;
    const backup = JSON.parse(await file.text());
    const result = await api<{ restored: Record<string, number> }>("/data-safety/restore", { method: "POST", body: JSON.stringify({ confirmation, backup }) });
    setMessage(`Restore completed: ${Object.values(result.restored).reduce((sum, count) => sum + count, 0)} records processed.`);
  }
  async function setup2fa() {
    const setup = await api<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", { method: "POST" });
    setTwoFactor(setup);
  }
  async function enable2fa() {
    await api("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ otp }) });
    setTwoFactor(null); setOtp(""); setMessage("Two-factor authentication enabled.");
  }
  async function requestPasswordOtp(event: React.FormEvent) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message: "New password and confirmation do not match", tone: "error" } }));
      return;
    }
    const result = await api<{ message: string; recipient: string }>("/auth/change-password/request-otp", {
      method: "POST",
      body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
    });
    setPasswordOtpRecipient(result.recipient);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message: "Verification OTP sent", tone: "success" } }));
  }
  async function verifyPasswordOtp(event: React.FormEvent) {
    event.preventDefault();
    await api<{ message: string }>("/auth/change-password/verify-otp", { method: "POST", body: JSON.stringify({ otp: passwordOtp }) });
    window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message: "Password changed. Please sign in again.", tone: "success" } }));
    window.setTimeout(onPasswordChanged, 700);
  }
  return <section><div className="sectionHead"><div><span className="eyebrow">Disaster recovery</span><h2>Backup & Restore</h2></div></div>
    <div className="analyticsGrid"><article className="chartPanel"><h3>Download backup</h3><p className="muted">Exports finance data, users, configuration and integrity-protected audit logs as versioned JSON.</p><button className="primary" onClick={backup}>Download Backup</button></article>
      <article className="chartPanel"><h3>Restore backup</h3><p className="muted">Safely upserts records by ID. Existing audit history is never overwritten.</p><label className="secondary fileButton">Select Backup<input type="file" accept=".json,application/json" onChange={(e) => restore(e.target.files?.[0])} /></label></article>
      <article className="chartPanel"><h3>Two-factor authentication</h3><p className="muted">Protect this Super Admin account with any TOTP authenticator app.</p>{!twoFactor ? <button className="secondary" onClick={setup2fa}>Set up 2FA</button> : <><p>Enter this secret in your authenticator:</p><code className="secretCode">{twoFactor.secret}</code><label>Verification code<input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></label><button className="primary compact" disabled={otp.length !== 6} onClick={enable2fa}>Verify & Enable</button></>}</article>
      <article className="chartPanel passwordSecurityCard"><h3>Change Super Admin password</h3><p className="muted">Email OTP verification is required. All sessions will be signed out after the change.</p>{!passwordOtpRecipient ? <form onSubmit={requestPasswordOtp} autoComplete="off">
        <label>Current password<span className="passwordField"><input type={showPasswords.current ? "text" : "password"} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} autoComplete="current-password" required /><button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })} aria-label="Show current password">{showPasswords.current ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>New password<span className="passwordField"><input type={showPasswords.next ? "text" : "password"} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPasswords({ ...showPasswords, next: !showPasswords.next })} aria-label="Show new password">{showPasswords.next ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>Confirm new password<span className="passwordField"><input type={showPasswords.confirm ? "text" : "password"} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })} aria-label="Show confirmation password">{showPasswords.confirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <small className="muted">Minimum 8 characters with uppercase, lowercase, number and special character.</small><button className="primary compact">Send Verification OTP</button>
      </form> : <form className="passwordOtpForm" onSubmit={verifyPasswordOtp}><div className="otpSentBadge"><CheckCircle2 size={21} /><span>OTP sent to <strong>{passwordOtpRecipient}</strong><small>Valid for 10 minutes</small></span></div><label>6-digit verification code<input className="otpInput" inputMode="numeric" pattern="\d{6}" maxLength={6} value={passwordOtp} onChange={(event) => setPasswordOtp(event.target.value.replace(/\D/g, ""))} autoFocus required /></label><div className="buttonRow"><button className="primary compact" disabled={passwordOtp.length !== 6}>Verify & Change Password</button><button type="button" className="secondary compact" onClick={() => { setPasswordOtpRecipient(""); setPasswordOtp(""); }}>Start Over</button></div></form>}</article></div>
    {message && <p className="successBox">{message}</p>}<div className="emptyState"><strong>Automated backups:</strong> schedule <code>npm run backup</code> daily using Task Scheduler or cron. The script retains the latest 14 snapshots.</div>
  </section>;
}

function ExpensesView({ user }: { user: User }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<MasterOption[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", payType: "", bankAccount: "", employeeId: "" });
  const [page, setPage] = useState(1);
  const [proofPreview, setProofPreview] = useState<{ name: string; data: string } | null>(null);

  const isSuperAdmin = user.role === "super_admin";
  const canCreate = canAction(user, "expenses.create");
  const canEdit = canAction(user, "expenses.edit");
  const canArchive = canAction(user, "expenses.archive");

  async function load() {
    const [expenseData, categoryData, userData, bankAccountData] = await Promise.all([
      api<Expense[]>("/expenses"),
      api<MasterOption[]>("/options/expense_category"),
      api<User[]>("/users"),
      api<BankAccount[]>("/bank-accounts")
    ]);
    setExpenses(expenseData);
    setCategories(categoryData);
    setEmployees(userData.filter((item) => item.role === "employee" && item.isActive !== false).map((item) => ({ ...item, id: item.id || item._id || "" })));
    setBankAccounts(bankAccountData);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteExpense(expense: Expense) {
    if (!await confirmPopup("Archive this expense entry?", "Archive expense")) return;
    await api(`/expenses/${expense._id}`, { method: "DELETE" });
    await load();
  }

  const filteredExpenses = expenses.filter((expense) => {
    const dateOk = withinDateRange(expense.createdAt, filters.from, filters.to);
    const payTypeOk =
      !filters.payType ||
      (filters.payType === "cash" && expense.paidFrom === "office" && expense.paymentMode === "cash") ||
      (filters.payType === "bank" && expense.paidFrom === "office" && expense.paymentMode === "bank") ||
      (filters.payType === "employee" && expense.paidFrom === "employee");
    const bankOk = !filters.bankAccount || expense.bankAccount === filters.bankAccount;
    const employeeOk = !filters.employeeId || expense.spentByEmployeeId === filters.employeeId;
    return dateOk && payTypeOk && bankOk && employeeOk;
  });
  const pagedExpenses = paginateRows(filteredExpenses, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Workflow</span>
          <h2>Expense requests</h2>
        </div>
        {canCreate && <button
          className="primary compact"
          onClick={() => {
            setEditingExpense(null);
            setFormOpen((value) => !value);
          }}
        >
          <Plus size={16} /> New Expense
        </button>}
      </div>
      {error && <p className="error">{error}</p>}
      <MasterOptionManager title="Expense Categories" type="expense_category" options={categories} onChanged={load} canManage={canAction(user, "expenses.manage_categories")} />
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
        <label>
          Paid Type
          <select value={filters.payType} onChange={(event) => { setFilters({ ...filters, payType: event.target.value, bankAccount: "", employeeId: "" }); setPage(1); }}>
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="employee">Employee</option>
          </select>
        </label>
        {filters.payType === "bank" && (
          <label>
            Bank
            <select value={filters.bankAccount} onChange={(event) => { setFilters({ ...filters, bankAccount: event.target.value }); setPage(1); }}>
              <option value="">All Banks</option>
              {bankAccounts.map((account) => {
                const label = `${account.bankName} - ${account.accountNumber}`;
                return <option key={account._id} value={label}>{label}</option>;
              })}
            </select>
          </label>
        )}
        {filters.payType === "employee" && (
          <label>
            Employee
            <select value={filters.employeeId} onChange={(event) => { setFilters({ ...filters, employeeId: event.target.value }); setPage(1); }}>
              <option value="">All Employees</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
        )}
      </FilterBar>
      {formOpen && (
        <ExpenseForm
          categories={categories}
          employees={employees}
          bankAccounts={bankAccounts}
          initialExpense={editingExpense}
          onCancel={() => {
            setEditingExpense(null);
            setFormOpen(false);
          }}
          onSaved={() => {
            setEditingExpense(null);
            setFormOpen(false);
            load();
          }}
        />
      )}
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Purpose</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid From</th>
              <th>Payment</th>
              <th>Bank</th>
              <th>Proof</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedExpenses.map((expense) => (
              <tr key={expense._id}>
                <td>{expense.purpose}</td>
                <td>{expense.category}</td>
                <td>{rupee(expense.amount)}</td>
                <td><Status value={expense.status} /></td>
                <td>{expense.paidFrom === "employee" ? expense.spentByEmployeeName || "Employee" : "Office"}</td>
                <td>{expense.paymentMode || ""}</td>
                <td>{expense.bankAccount || ""}</td>
                <td>
                  {expense.proofFileName ? (
                    <UploadedFileButton
                      fileName={expense.proofFileName}
                      available={Boolean(expense.proofData)}
                      onView={() => setProofPreview({ name: expense.proofFileName!, data: expense.proofData! })}
                    />
                  ) : <span className="muted">No proof</span>}
                </td>
                <td>{expense.remarks || ""}</td>
                <td className="actions">
                  {(canEdit || canArchive) && (
                    <RowActions
                      onEdit={canEdit ? () => {
                        setEditingExpense(expense);
                        setFormOpen(true);
                      } : undefined}
                      onDelete={canArchive ? () => deleteExpense(expense) : undefined}
                      deleteTitle="Archive"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filteredExpenses.length} onPage={setPage} />
      {proofPreview && <FilePreviewModal fileName={proofPreview.name} data={proofPreview.data} onClose={() => setProofPreview(null)} />}
    </section>
  );
}

function ExpenseForm({
  categories,
  employees,
  bankAccounts,
  initialExpense,
  onSaved,
  onCancel
}: {
  categories: MasterOption[];
  employees: User[];
  bankAccounts: BankAccount[];
  initialExpense: Expense | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [proofPreview, setProofPreview] = useState<{ name: string; data: string } | null>(null);
  const [form, setForm] = useState({
    category: initialExpense?.category || categories[0]?.name || "",
    purpose: initialExpense?.purpose || "",
    amount: initialExpense?.amount || 0,
    vendor: initialExpense?.vendor || "",
    expectedDate: toDateInputValue(initialExpense?.expectedDate),
    paidFrom: initialExpense?.paidFrom || "office",
    spentByEmployeeId: initialExpense?.spentByEmployeeId || "",
    spentByEmployeeName: initialExpense?.spentByEmployeeName || "",
    paymentMode: initialExpense?.paymentMode === "cash" ? "cash" : initialExpense?.paymentMode ? "bank" : "cash",
    bankAccount: initialExpense?.bankAccount || "",
    proofFileName: initialExpense?.proofFileName || "",
    proofData: initialExpense?.proofData || "",
    remarks: initialExpense?.remarks || "",
    paidByEmployee: initialExpense?.paidByEmployee || false
  });

  useEffect(() => {
    if (!form.category && categories[0]) setForm((current) => ({ ...current, category: categories[0].name }));
  }, [categories]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const selectedEmployee = employees.find((employee) => employee.id === form.spentByEmployeeId);
    await api(initialExpense ? `/expenses/${initialExpense._id}` : "/expenses", {
      method: initialExpense ? "PATCH" : "POST",
      body: JSON.stringify(cleanPayload({
        category: form.category,
        purpose: form.purpose,
        amount: form.amount,
        vendor: form.vendor,
        expectedDate: form.expectedDate,
        remarks: form.remarks,
        proofFileName: form.proofFileName,
        proofData: form.proofData,
        paidFrom: form.paidFrom,
        paidByEmployee: form.paidFrom === "employee",
        spentByEmployeeId: form.paidFrom === "employee" ? form.spentByEmployeeId : "",
        spentByEmployeeName: form.paidFrom === "employee" ? selectedEmployee?.name || form.spentByEmployeeName : "",
        paymentMode: form.paidFrom === "office" ? form.paymentMode : "cash",
        bankAccount: form.paidFrom === "office" && form.paymentMode === "bank" ? form.bankAccount : ""
      }))
    });
    onSaved();
  }

  async function handleProof(file: File | undefined) {
    if (!file) {
      setForm({ ...form, proofFileName: "", proofData: "" });
      return;
    }
    if (file.size > 1_400_000) {
      window.dispatchEvent(new CustomEvent("efms:toast", { detail: { message: "Proof file must be smaller than 1.4 MB", tone: "error" } }));
      return;
    }
    const proofData = await fileToDataUrl(file);
    setForm({ ...form, proofFileName: file.name, proofData });
  }

  return (
    <form className="formGrid" onSubmit={submit}>
      <label>
        Category
        <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
          <option value="" disabled>Create category first</option>
          {categories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
        </select>
      </label>
      <label>Purpose<input value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} required /></label>
      <label>Amount<input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label>
      <label>Vendor<input value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} /></label>
      <label>Expected Date<input type="date" value={form.expectedDate} onChange={(event) => setForm({ ...form, expectedDate: event.target.value })} /></label>
      <label>
        Paid From
        <select
          value={form.paidFrom}
          onChange={(event) => setForm({ ...form, paidFrom: event.target.value as "office" | "employee", bankAccount: "", paymentMode: event.target.value === "employee" ? "cash" : form.paymentMode })}
        >
          <option value="office">Office</option>
          <option value="employee">Employee</option>
        </select>
      </label>
      {form.paidFrom === "employee" && (
        <label>
          Employee
          <select value={form.spentByEmployeeId} onChange={(event) => setForm({ ...form, spentByEmployeeId: event.target.value })} required>
            <option value="" disabled>Create employee first</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
        </label>
      )}
      {form.paidFrom === "office" && (
        <label>
          Payment Method
          <select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value as "cash" | "bank", bankAccount: event.target.value === "cash" ? "" : form.bankAccount })}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
        </label>
      )}
      {form.paidFrom === "office" && form.paymentMode === "bank" && (
        <label>
          Bank Account
          <select value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} required>
            <option value="" disabled>Create bank account first</option>
            {bankAccounts.filter((account) => account.isActive !== false).map((account) => {
              const label = `${account.bankName} - ${account.accountNumber}`;
              return <option key={account._id} value={label}>{label}</option>;
            })}
          </select>
        </label>
      )}
      <label>
        Proof Upload
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.avif,.gif,.pdf,image/png,image/jpeg,image/webp,image/avif,image/gif,application/pdf" onChange={(event) => handleProof(event.target.files?.[0])} />
        {form.proofFileName && form.proofData && <UploadedFileButton fileName={form.proofFileName} available onView={() => setProofPreview({ name: form.proofFileName, data: form.proofData })} />}
      </label>
      <label className="wide">Remarks<textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} rows={3} /></label>
      <div className="formActions">
        <button className="primary compact">{initialExpense ? "Update Expense" : "Submit"}</button>
        <button className="secondary compact" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {proofPreview && <FilePreviewModal fileName={proofPreview.name} data={proofPreview.data} onClose={() => setProofPreview(null)} />}
    </form>
  );
}

function VouchersView({ user }: { user: User }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [receiptVoucher, setReceiptVoucher] = useState<Voucher | null>(null);
  const isSuperAdmin = user.role === "super_admin";
  async function load() {
    const [voucherData, userData, bankData] = await Promise.all([api<Voucher[]>("/vouchers"), api<User[]>("/users"), api<BankAccount[]>("/bank-accounts")]);
    setVouchers(voucherData);
    setEmployees(userData.filter((item) => item.role === "employee").map((item) => ({ ...item, id: item.id || item._id || "" })));
    setBankAccounts(bankData);
  }
  useEffect(() => {
    load();
  }, []);

  async function deleteVoucher(voucher: Voucher) {
    if (!await confirmPopup("Cancel this voucher?", "Cancel voucher", "Cancel Voucher")) return;
    await api(`/vouchers/${voucher._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Records</span>
          <h2>Vouchers</h2>
        </div>
        <button
          className="primary compact"
          onClick={() => {
            setEditingVoucher(null);
            setFormOpen((value) => !value);
          }}
        >
          <Plus size={16} /> New Voucher
        </button>
      </div>
      {formOpen && (
        <VoucherForm
          employees={employees}
          bankAccounts={bankAccounts}
          initialVoucher={editingVoucher}
          onCancel={() => {
            setEditingVoucher(null);
            setFormOpen(false);
          }}
          onSaved={(voucher) => {
            setEditingVoucher(null);
            setFormOpen(false);
            if (voucher) setReceiptVoucher(voucher);
            load();
          }}
        />
      )}
      {receiptVoucher && <VoucherReceipt voucher={receiptVoucher} onClose={() => setReceiptVoucher(null)} />}
      <SimpleTable
        rows={vouchers}
        columns={["voucherNumber", "type", "receiver", "purpose", "amount", "paymentMode", "bankAccount", "referenceNo", "remarks", "status"]}
        moneyColumn="amount"
        renderActions={
          isSuperAdmin
            ? (voucher) => (
                <>
                  <button className="iconButton" onClick={() => downloadServerPdf(`/vouchers/${voucher._id}/pdf`, `${voucher.voucherNumber}.pdf`)} title="Download PDF"><Download size={16} /></button>
                  <RowActions
                    onEdit={() => {
                      setEditingVoucher(voucher);
                      setFormOpen(true);
                    }}
                    onDelete={() => deleteVoucher(voucher)}
                    deleteTitle="Cancel"
                  />
                </>
              )
            : undefined
        }
      />
    </section>
  );
}

function VoucherForm({
  employees,
  bankAccounts,
  initialVoucher,
  onSaved,
  onCancel
}: {
  employees: User[];
  bankAccounts: BankAccount[];
  initialVoucher: Voucher | null;
  onSaved: (voucher?: Voucher) => void;
  onCancel: () => void;
}) {
  const matchedEmployee = employees.find((employee) => employee.name === initialVoucher?.receiver);
  const [form, setForm] = useState({
    type: initialVoucher?.type || "payment",
    receiverMode: matchedEmployee ? matchedEmployee.id : initialVoucher?.receiver ? "other" : "",
    receiver: matchedEmployee ? matchedEmployee.name : initialVoucher?.receiver || "",
    purpose: initialVoucher?.purpose || "",
    amount: initialVoucher?.amount || 0,
    paymentMode: initialVoucher?.paymentMode || "cash",
    bankAccount: initialVoucher?.bankAccount || "",
    referenceNo: initialVoucher?.referenceNo || "",
    remarks: initialVoucher?.remarks || ""
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const selectedEmployee = employees.find((employee) => employee.id === form.receiverMode);
    const receiver = form.receiverMode === "other" ? form.receiver : selectedEmployee?.name || "";
    const voucher = await api<Voucher>(initialVoucher ? `/vouchers/${initialVoucher._id}` : "/vouchers", {
      method: initialVoucher ? "PATCH" : "POST",
      body: JSON.stringify(cleanPayload({
        type: form.type,
        receiver,
        purpose: form.purpose,
        amount: form.amount,
        paymentMode: form.paymentMode,
        bankAccount: form.paymentMode === "bank" ? form.bankAccount : "",
        referenceNo: form.referenceNo,
        remarks: form.remarks
      }))
    });
    onSaved(voucher);
  }

  return (
    <form className="formGrid" onSubmit={submit}>
      <label>
        Voucher Type
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          <option value="payment">Payment Voucher</option>
        </select>
      </label>
      <label>
        Receiver
        <select value={form.receiverMode} onChange={(event) => setForm({ ...form, receiverMode: event.target.value, receiver: event.target.value === "other" ? "" : employees.find((employee) => employee.id === event.target.value)?.name || "" })}>
          <option value="">Select employee</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          <option value="other">Other</option>
        </select>
      </label>
      {form.receiverMode === "other" && <label>Receiver Name<input value={form.receiver} onChange={(event) => setForm({ ...form, receiver: event.target.value })} required /></label>}
      <label>Amount<input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label>
      <label>
        Payment Mode
        <select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value, bankAccount: event.target.value === "cash" ? "" : form.bankAccount })}>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
        </select>
      </label>
      {form.paymentMode === "bank" && (
        <label>
          Bank Account
          <select value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} required>
            <option value="" disabled>Create bank account first</option>
            {bankAccounts.filter((account) => account.isActive !== false).map((account) => {
              const label = `${account.bankName} - ${account.accountNumber}`;
              return <option key={account._id} value={label}>{label}</option>;
            })}
          </select>
        </label>
      )}
      <label>Reference No.<input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} /></label>
      <label className="wide">Purpose<textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} rows={3} required /></label>
      <label className="wide">Remarks<textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} rows={3} /></label>
      <div className="formActions">
        <button className="primary compact">{initialVoucher ? "Update Voucher" : "Create Voucher"}</button>
        <button className="secondary compact" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function VoucherReceipt({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const receiptCopy = (copyLabel: string) => (
    <div className="receiptCopy">
      <div className="receiptHead">
        <div>
          <span className="eyebrow">EFMS</span>
          <h2>Payment Voucher Receipt</h2>
          <small>{copyLabel}</small>
        </div>
        <strong>{voucher.voucherNumber}</strong>
      </div>
      <div className="receiptGrid">
        <span>Date</span><strong>{toDateInputValue(voucher.createdAt)}</strong>
        <span>Paid To</span><strong>{voucher.receiver || "Other"}</strong>
        <span>Purpose</span><strong>{voucher.purpose}</strong>
        <span>Amount</span><strong>{rupee(voucher.amount)}</strong>
        <span>Payment Mode</span><strong>{voucher.paymentMode}</strong>
        <span>Bank Account</span><strong>{voucher.bankAccount || "-"}</strong>
        <span>Reference No.</span><strong>{voucher.referenceNo || "-"}</strong>
        <span>Remarks</span><strong>{voucher.remarks || "-"}</strong>
      </div>
      <div className="receiptSignatures">
        <span>Prepared By</span>
        <span>Receiver Signature</span>
        <span>Authorized Signatory</span>
      </div>
    </div>
  );

  return (
    <div className="receiptPanel">
      <div className="receipt" id="voucher-receipt">
        {receiptCopy("Office Copy")}
        <div className="receiptCutLine">Receiver Copy</div>
        {receiptCopy("Receiver Copy")}
      </div>
      <div className="formActions">
        <button className="primary compact" onClick={() => window.print()}>Print Receipt</button>
        <button className="secondary compact" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function InvoicesView({ user }: { user: User }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customer, setCustomer] = useState("");
  const [remarks, setRemarks] = useState("");
  const isSuperAdmin = user.role === "super_admin";

  async function load() {
    setInvoices(await api<Invoice[]>("/invoices"));
  }
  useEffect(() => {
    load();
  }, []);

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    await api("/invoices", {
      method: "POST",
      body: JSON.stringify({
        type: "tax_invoice",
        customer,
        remarks,
        lines: [{ description: "Consulting Service", quantity: 1, unitPrice: 10000, gstRate: 18 }]
      })
    });
    setCustomer("");
    setRemarks("");
    await load();
  }

  async function editInvoice(invoice: Invoice) {
    const customerName = await promptPopup("Customer", invoice.customer, "Edit invoice");
    if (customerName === null) return;
    const nextRemarks = await promptPopup("Remarks", invoice.remarks || "", "Edit invoice");
    if (nextRemarks === null) return;
    await api(`/invoices/${invoice._id}`, { method: "PATCH", body: JSON.stringify({ customer: customerName, remarks: nextRemarks }) });
    await load();
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!await confirmPopup("Cancel this invoice?", "Cancel invoice", "Cancel Invoice")) return;
    await api(`/invoices/${invoice._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Billing</span>
          <h2>Invoices</h2>
        </div>
      </div>
      <form className="inlineForm" onSubmit={createInvoice}>
        <input placeholder="Customer name" value={customer} onChange={(event) => setCustomer(event.target.value)} required />
        <input placeholder="Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        <button className="primary compact">Create Demo Tax Invoice</button>
      </form>
      <SimpleTable
        rows={invoices}
        columns={["invoiceNumber", "type", "customer", "subtotal", "gstAmount", "totalAmount", "remarks", "status"]}
        moneyColumn="totalAmount"
        renderActions={(invoice) => <>
          <button className="iconButton" onClick={() => downloadServerPdf(`/invoices/${invoice._id}/pdf`, `${invoice.invoiceNumber}.pdf`)} title="Download PDF"><Download size={16} /></button>
          {isSuperAdmin && <RowActions onEdit={() => editInvoice(invoice)} onDelete={() => deleteInvoice(invoice)} deleteTitle="Cancel" />}
        </>}
      />
    </section>
  );
}

function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    api<User[]>("/users").then(setUsers).catch(() => setUsers([]));
  }, []);
  return <SimpleTable title="Users" rows={users} columns={["name", "email", "role"]} />;
}

function RolesStaffView({ user }: { user: User }) {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [staffMode, setStaffMode] = useState<"new" | "employee">("new");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [editingRole, setEditingRole] = useState<RoleOption | null>(null);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", sidebarPermissions: [] as string[], dashboardPermissions: [] as string[], actionPermissions: [] as string[] });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "", phone: "", designation: "", department: "General" });

  async function load() {
    const [roleData, userData] = await Promise.all([api<RoleOption[]>("/roles"), api<User[]>("/users")]);
    setRoles(roleData);
    setEmployees(userData.filter((item) => item.role === "employee").map((item) => ({ ...item, id: item.id || item._id || "" })));
    setStaff(userData.filter((item) => (item.role !== "employee" && item.role !== "super_admin") || (item.role === "employee" && item.accessRole)).map((item) => ({ ...item, id: item.id || item._id || "" })));
  }

  useEffect(() => {
    if (user.role === "super_admin") load();
  }, []);

  if (user.role !== "super_admin") {
    return <div className="emptyState">Only Super Admin can manage roles and staff.</div>;
  }

  function resetRoleForm() {
    setEditingRole(null);
    setRoleForm({ name: "", description: "", sidebarPermissions: [], dashboardPermissions: [], actionPermissions: [] });
  }

  function resetStaffForm() {
    setEditingStaff(null);
    setStaffMode("new");
    setSelectedEmployeeId("");
    setStaffForm({ name: "", email: "", password: "", role: "", phone: "", designation: "", department: "General" });
  }

  async function saveRole(event: React.FormEvent) {
    event.preventDefault();
    await api(editingRole ? `/roles/${editingRole._id}` : "/roles", {
      method: editingRole ? "PATCH" : "POST",
      body: JSON.stringify({ ...roleForm, isActive: editingRole?.isActive ?? true })
    });
    resetRoleForm();
    await load();
  }

  async function setRoleActive(role: RoleOption, isActive: boolean) {
    await api(`/roles/${role._id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    await load();
  }

  async function archiveRole(role: RoleOption) {
    if (!await confirmPopup(`Archive role ${role.name}?`, "Archive role")) return;
    await api(`/roles/${role._id}`, { method: "DELETE" });
    await load();
  }

  async function saveStaff(event: React.FormEvent) {
    event.preventDefault();
    const employeeId = staffMode === "employee" ? (selectedEmployeeId || editingStaff?.id) : "";
    if (staffMode === "employee" && !employeeId) return;
    const target = employeeId || editingStaff?.id;
    const payload = staffMode === "employee"
      ? { name: staffForm.name, email: staffForm.email, phone: staffForm.phone || undefined, designation: staffForm.designation, department: staffForm.department, accessRole: staffForm.role, password: staffForm.password || undefined, isActive: true }
      : { ...staffForm, password: editingStaff && !staffForm.password ? undefined : staffForm.password, isActive: editingStaff?.isActive ?? true };
    await api(target ? `/users/${target}` : "/users", { method: target ? "PATCH" : "POST", body: JSON.stringify(cleanPayload(payload)) });
    resetStaffForm();
    await load();
  }

  async function setStaffActive(staffUser: User, isActive: boolean) {
    await api(`/users/${staffUser.id}`, { method: "PATCH", body: JSON.stringify(staffUser.role === "employee" ? { accessRole: isActive ? staffUser.accessRole : "" } : { isActive }) });
    await load();
  }

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Access Control</span>
          <h2>Roles & Staff</h2>
        </div>
      </div>
      <form className="formGrid" onSubmit={saveRole}>
        <label>Role Name<input value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} placeholder="Example: branch_manager" required /></label>
        <label className="wide">Description<textarea value={roleForm.description} onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })} rows={3} /></label>
        <PermissionChecklist
          title="Sidebar Features"
          options={nav.filter((item) => item.id !== "roles").map((item) => ({ id: item.id, label: item.label }))}
          values={roleForm.sidebarPermissions}
          onChange={(values) => setRoleForm({ ...roleForm, sidebarPermissions: values })}
        />
        <PermissionChecklist
          title="Dashboard Cards"
          options={dashboardPermissionOptions}
          values={roleForm.dashboardPermissions}
          onChange={(values) => setRoleForm({ ...roleForm, dashboardPermissions: values })}
        />
        {actionPermissionGroups.map((group) => <PermissionChecklist key={group.title} title={`${group.title} Actions`} options={group.options} values={roleForm.actionPermissions} onChange={(values) => setRoleForm({ ...roleForm, actionPermissions: values })} />)}
        <div className="formActions">
          <button className="primary compact">{editingRole ? "Update Role" : "Create Role"}</button>
          {editingRole && <button type="button" className="secondary compact" onClick={resetRoleForm}>Cancel</button>}
        </div>
      </form>
      <SimpleTable
        rows={roles}
        columns={["name", "description", "isActive", "createdAt"]}
        renderActions={(role) => (
          <>
            <button className="iconButton" onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, description: role.description || "", sidebarPermissions: role.sidebarPermissions || [], dashboardPermissions: role.dashboardPermissions || [], actionPermissions: role.actionPermissions || [] }); }} title="Edit"><Pencil size={16} /></button>
            {role.isActive ? (
              <button className="iconButton bad" onClick={() => setRoleActive(role, false)} title="Deactivate"><XCircle size={16} /></button>
            ) : (
              <button className="iconButton good" onClick={() => setRoleActive(role, true)} title="Activate"><CheckCircle2 size={16} /></button>
            )}
            <button className="iconButton bad" onClick={() => archiveRole(role)} title="Archive"><Trash2 size={16} /></button>
          </>
        )}
      />
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Login Users</span>
          <h2>Staff</h2>
        </div>
      </div>
      <form className="formGrid" onSubmit={saveStaff}>
        <label>
          Account Type
          <select value={staffMode} onChange={(event) => { const mode = event.target.value as "new" | "employee"; resetStaffForm(); setStaffMode(mode); }} disabled={Boolean(editingStaff)}>
            <option value="new">Create new staff</option>
            <option value="employee">Give login to employee</option>
          </select>
        </label>
        {staffMode === "employee" && !editingStaff && <label>
          Select Employee
          <select value={selectedEmployeeId} onChange={(event) => {
            const id = event.target.value; setSelectedEmployeeId(id);
            const employee = employees.find((item) => item.id === id);
            if (employee) setStaffForm({ name: employee.name || "", email: employee.email || "", password: "", role: employee.accessRole || "", phone: sensitiveFormValue(employee.phone), designation: employee.designation || "", department: employee.department || "General" });
          }} required>
            <option value="" disabled>Select existing employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} - {employee.email}</option>)}
          </select>
        </label>}
        <label>Name<input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} required /></label>
        <label>Email<input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} required /></label>
        <label>Password<input type="password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} required={!editingStaff} placeholder={editingStaff ? "Leave blank to keep old password" : ""} /></label>
        <label>
          Role
          <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })} required>
            <option value="" disabled>Create/select role</option>
            {roles.filter((role) => role.isActive).map((role) => <option key={role._id} value={role.name}>{role.name}</option>)}
          </select>
        </label>
        <label>Phone<input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} placeholder={staffMode === "employee" ? "Re-enter only if required" : "Enter phone number"} /></label>
        <label>Designation<input value={staffForm.designation} onChange={(event) => setStaffForm({ ...staffForm, designation: event.target.value })} /></label>
        <label>Department<input value={staffForm.department} onChange={(event) => setStaffForm({ ...staffForm, department: event.target.value })} /></label>
        <div className="formActions">
          <button className="primary compact">{editingStaff ? "Update Login Access" : staffMode === "employee" ? "Enable Employee Login" : "Create Staff"}</button>
          {editingStaff && <button type="button" className="secondary compact" onClick={resetStaffForm}>Cancel</button>}
        </div>
      </form>
      <SimpleTable
        rows={staff}
        columns={["name", "email", "role", "accessRole", "phone", "designation", "department", "isActive"]}
        renderActions={(staffUser) => (
          <>
            <button
              className="iconButton"
              onClick={() => {
                setEditingStaff(staffUser);
                setStaffMode(staffUser.role === "employee" ? "employee" : "new");
                setSelectedEmployeeId(staffUser.role === "employee" ? staffUser.id : "");
                setStaffForm({
                  name: staffUser.name || "",
                  email: staffUser.email || "",
                  password: "",
                  role: staffUser.role === "employee" ? staffUser.accessRole || "" : staffUser.role || "",
                  phone: sensitiveFormValue(staffUser.phone),
                  designation: staffUser.designation || "",
                  department: staffUser.department || "General"
                });
              }}
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            {staffUser.role !== "employee" && staffUser.isActive === false ? (
              <button className="iconButton good" onClick={() => setStaffActive(staffUser, true)} title="Activate"><CheckCircle2 size={16} /></button>
            ) : (
              <button className="iconButton bad" onClick={() => setStaffActive(staffUser, false)} title={staffUser.role === "employee" ? "Revoke login access" : "Deactivate"}><XCircle size={16} /></button>
            )}
          </>
        )}
      />
    </section>
  );
}

function ActivityView() {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", action: "" });
  const [page, setPage] = useState(1);
  useEffect(() => {
    api<Array<Record<string, unknown>>>("/activity").then(setLogs).catch(() => setLogs([]));
  }, []);

  const filteredLogs = logs.filter((log) => withinDateRange(String(log.createdAt || ""), filters.from, filters.to) && (!filters.action || String(log.action || "").includes(filters.action)));
  const pagedLogs = paginateRows(filteredLogs, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Audit Trail</span>
          <h2>Activity Logs</h2>
        </div>
      </div>
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
        <label>Action Search<input value={filters.action} onChange={(event) => { setFilters({ ...filters, action: event.target.value }); setPage(1); }} placeholder="voucher.create" /></label>
      </FilterBar>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Role</th>
              <th>IP</th>
              <th>Device</th>
              <th>Browser</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {pagedLogs.map((log, index) => {
              const actor = log.userId as { name?: string; email?: string; role?: string } | undefined;
              return (
                <tr className="clickableRow" key={String(log._id || index)} onClick={() => setSelectedLog(log)}>
                  <td>{formatDateTime(String(log.createdAt || ""))}</td>
                  <td>{String(log.action || "")}</td>
                  <td>{actor?.name || "System"}<br /><span className="muted">{actor?.email || ""}</span></td>
                  <td>{actor?.role || ""}</td>
                  <td>{String(log.ipAddress || "")}</td>
                  <td>{String(log.deviceType || "")}</td>
                  <td>{String(log.browser || "")}</td>
                  <td>{String(log.entityType || "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filteredLogs.length} onPage={setPage} />
      {selectedLog && <ActivityProof log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </section>
  );
}

function ActivityProof({ log, onClose }: { log: Record<string, unknown>; onClose: () => void }) {
  const actor = log.userId as { name?: string; email?: string; role?: string } | undefined;
  return (
    <div className="proofPanel">
      <div className="sectionHead">
        <div>
          <span className="eyebrow">Full Proof</span>
          <h2>{String(log.action || "Activity")}</h2>
        </div>
        <button className="secondary compact" onClick={onClose}>Close</button>
      </div>
      <div className="proofGrid">
        <span>Timestamp</span><strong>{formatDateTime(String(log.createdAt || ""))}</strong>
        <span>User</span><strong>{actor?.name || "System"} ({actor?.email || "no email"})</strong>
        <span>Role</span><strong>{actor?.role || "-"}</strong>
        <span>IP Address</span><strong>{String(log.ipAddress || "-")}</strong>
        <span>Device</span><strong>{String(log.deviceType || "-")}</strong>
        <span>Browser / OS</span><strong>{String(log.browser || "-")} / {String(log.os || "-")}</strong>
        <span>User Agent</span><strong>{String(log.userAgent || "-")}</strong>
        <span>Entity</span><strong>{String(log.entityType || "-")} / {String(log.entityId || "-")}</strong>
        <span>Reason</span><strong>{String(log.reason || "-")}</strong>
      </div>
      <div className="proofColumns">
        <div>
          <h3>Before Edit / Old Value</h3>
          <pre>{JSON.stringify(log.oldValue || {}, null, 2)}</pre>
        </div>
        <div>
          <h3>After Activity / New Value</h3>
          <pre>{JSON.stringify(log.newValue || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

function SimpleTable<T extends Record<string, unknown>>({
  title,
  rows,
  columns,
  moneyColumn,
  renderActions
}: {
  title?: string;
  rows: T[];
  columns: string[];
  moneyColumn?: string;
  renderActions?: (row: T) => JSX.Element;
}) {
  return (
    <section>
      {title && (
        <div className="sectionHead">
          <div>
            <span className="eyebrow">Records</span>
            <h2>{title}</h2>
          </div>
        </div>
      )}
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column}>{column}</th>)}
              {renderActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row._id ?? index)}>
                {columns.map((column) => (
                  <td key={column}>{formatCell(row, column, moneyColumn)}</td>
                ))}
                {renderActions && <td className="actions">{renderActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MasterOptionManager({
  title,
  type,
  options,
  onChanged,
  canManage
}: {
  title: string;
  type: "expense_category" | "earning_source" | "project";
  options: MasterOption[];
  onChanged: () => Promise<void>;
  canManage: boolean;
}) {
  const [name, setName] = useState("");

  async function createOption(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await api(`/options/${type}`, { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    setName("");
    await onChanged();
  }

  async function editOption(option: MasterOption) {
    const nextName = await promptPopup("Name", option.name, "Edit option");
    if (!nextName) return;
    await api(`/options/${type}/${option._id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) });
    await onChanged();
  }

  async function deleteOption(option: MasterOption) {
    if (!await confirmPopup(`Archive ${option.name}?`, "Archive option")) return;
    await api(`/options/${type}/${option._id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <div className="masterBox">
      <div>
        <strong>{title}</strong>
        <div className="chips">
          {options.length === 0 && <span className="muted">Create one first, then it will appear in dropdown.</span>}
          {options.map((option) => (
            <span className="chip" key={option._id}>
              {option.name}
              {canManage && (
                <>
                  <button type="button" onClick={() => editOption(option)} title="Edit"><Pencil size={13} /></button>
                  <button type="button" onClick={() => deleteOption(option)} title="Archive"><Trash2 size={13} /></button>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
      {canManage && (
        <form className="masterForm" onSubmit={createOption}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Create ${title.slice(0, -1)}`} />
          <button className="primary compact">
            <Plus size={16} /> Add
          </button>
        </form>
      )}
    </div>
  );
}

function PayrollView({ user }: { user: User }) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [eligible, setEligible] = useState<Array<{ _id: string; purpose: string; category: string; amount: number }>>([]);
  const [form, setForm] = useState({ employeeId: "", salaryMonth: new Date().toISOString().slice(0, 7), includeExpenses: true, paymentMode: "bank", bankAccountId: "", referenceNo: "", paymentDate: new Date().toISOString().slice(0, 10), remarks: "" });
  const selectedEmployee = employees.find((item) => (item.id || item._id) === form.employeeId);
  const reimbursement = eligible.reduce((sum, item) => sum + Number(item.amount), 0);
  const total = Number(selectedEmployee?.basicSalary || 0) + (form.includeExpenses ? reimbursement : 0);

  async function load() {
    const [payrollData, users, accounts] = await Promise.all([api<Payroll[]>("/payroll"), api<User[]>("/users"), api<BankAccount[]>("/bank-accounts")]);
    setPayrolls(payrollData); setEmployees(users.filter((item) => item.role === "employee" && item.isActive !== false)); setBanks(accounts.filter((item) => item.isActive !== false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!form.employeeId) { setEligible([]); return; }
    api<Array<{ _id: string; purpose: string; category: string; amount: number }>>(`/payroll/eligible-expenses/${form.employeeId}`).then(setEligible).catch(() => setEligible([]));
  }, [form.employeeId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!await confirmPopup(`Release ${rupee(total)} for ${selectedEmployee?.name}?`, "Confirm payroll", "Release Payment")) return;
    await api("/payroll", { method: "POST", body: JSON.stringify(form) });
    setForm({ ...form, employeeId: "", bankAccountId: "", referenceNo: "", remarks: "" }); setEligible([]); await load();
  }

  return <section>
    <div className="sectionHead"><div><span className="eyebrow">Salary Settlement</span><h2>Payroll & Reimbursements</h2></div></div>
    {canAction(user, "payroll.create") && <form className="formGrid" onSubmit={submit}>
      <label>Employee<select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="" disabled>Select employee</option>{employees.map((employee) => <option key={employee.id || employee._id} value={employee.id || employee._id}>{employee.name}</option>)}</select></label>
      <label>Salary Month<input type="month" required value={form.salaryMonth} onChange={(e) => setForm({ ...form, salaryMonth: e.target.value })} /></label>
      <label>Payment Mode<select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value, bankAccountId: e.target.value === "cash" ? "" : form.bankAccountId })}><option value="bank">Bank</option><option value="cash">Cash</option></select></label>
      {form.paymentMode === "bank" && <label>Bank Account<select required value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}><option value="" disabled>Select bank</option>{banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.bankName} - {bank.accountNumber} ({rupee(bank.currentBalance)})</option>)}</select></label>}
      <label>Payment Date<input type="date" required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></label>
      <label>Reference No.<input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></label>
      <label className="checkboxRow"><input type="checkbox" checked={form.includeExpenses} onChange={(e) => setForm({ ...form, includeExpenses: e.target.checked })} /> Include pending employee expenses</label>
      <label className="wide">Remarks<textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
      <div className="summaryStrip wide"><strong>Salary: {rupee(Number(selectedEmployee?.basicSalary || 0))}</strong><strong>Reimbursement: {rupee(form.includeExpenses ? reimbursement : 0)} ({form.includeExpenses ? eligible.length : 0} entries)</strong><strong>Total payment: {rupee(total)}</strong></div>
      {form.includeExpenses && eligible.length > 0 && <div className="wide muted">Included: {eligible.map((item) => `${item.purpose} (${rupee(item.amount)})`).join(", ")}</div>}
      <div className="formActions"><button className="primary compact" disabled={!form.employeeId || total <= 0}>Release Salary</button></div>
    </form>}
    <SimpleTable rows={payrolls} columns={["payrollNumber", "employeeId.name", "salaryMonth", "basicSalary", "reimbursementAmount", "totalPaid", "paymentMode", "bankAccount", "paymentDate", "status"]} renderActions={(payroll) => <button className="iconButton" onClick={() => downloadServerPdf(`/payroll/${payroll._id}/pdf`, `${payroll.payrollNumber}.pdf`)} title="Download salary slip"><Download size={16} /></button>} />
  </section>;
}

function EmployeesView({ user }: { user: User }) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", status: "" });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    basicSalary: 0,
    aadharNo: "",
    address: "",
    designation: "",
    department: "General",
    joiningDate: ""
  });
  const canCreate = canAction(user, "employees.create");
  const canEdit = canAction(user, "employees.edit");
  const canDeactivate = canAction(user, "employees.deactivate");

  async function load() {
    const users = await api<User[]>("/users");
    setEmployees(users.filter((item) => item.role === "employee").map((item) => ({ ...item, id: item.id || item._id || "" })));
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingEmployee(null);
    setForm({ name: "", email: "", phone: "", basicSalary: 0, aadharNo: "", address: "", designation: "", department: "General", joiningDate: "" });
  }

  function startEdit(employee: User) {
    setEditingEmployee(employee);
    setForm({
      name: employee.name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      basicSalary: Number(employee.basicSalary || 0),
      aadharNo: employee.aadharNo || "",
      address: employee.address || "",
      designation: employee.designation || "",
      department: employee.department || "General",
      joiningDate: employee.joiningDate ? employee.joiningDate.slice(0, 10) : ""
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(editingEmployee ? `/users/${editingEmployee.id}` : "/users", {
      method: editingEmployee ? "PATCH" : "POST",
      body: JSON.stringify({
        ...form,
        role: "employee",
        password: "Employee@123",
        basicSalary: Number(form.basicSalary || 0),
        isActive: editingEmployee?.isActive ?? true
      })
    });
    resetForm();
    await load();
  }

  async function setActive(employee: User, isActive: boolean) {
    await api(`/users/${employee.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
    await load();
  }

  const filteredEmployees = employees.filter((employee) => {
    const statusOk = !filters.status || (filters.status === "active" ? employee.isActive !== false : employee.isActive === false);
    return statusOk && withinDateRange(employee.createdAt || employee.joiningDate || "", filters.from, filters.to);
  });
  const pagedEmployees = paginateRows(filteredEmployees, page);

  return (
    <section>
      <div className="sectionHead">
        <div>
          <span className="eyebrow">People</span>
          <h2>Employees</h2>
        </div>
      </div>
      {(canCreate || Boolean(editingEmployee && canEdit)) && (
        <form className="formGrid" onSubmit={submit}>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label>Phone No.<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Salary<input type="number" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: Number(event.target.value) })} /></label>
          <label>Aadhar No.<input value={form.aadharNo} onChange={(event) => setForm({ ...form, aadharNo: event.target.value })} /></label>
          <label>Designation<input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
          <label>Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
          <label>Joining Date<input type="date" value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} /></label>
          <label className="wide">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} rows={3} /></label>
          <div className="formActions">
            <button className="primary compact">{editingEmployee ? "Update Employee" : "Create Employee"}</button>
            {editingEmployee && <button className="secondary compact" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      )}
      <FilterBar>
        <label>From Date<input type="date" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} /></label>
        <label>To Date<input type="date" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} /></label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Deactive</option>
          </select>
        </label>
      </FilterBar>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Salary</th>
              <th>Expense</th>
              <th>Total Payable</th>
              <th>Aadhar</th>
              <th>Address</th>
              <th>Status</th>
              {(canEdit || canDeactivate) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pagedEmployees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td>{employee.email}</td>
                <td>{employee.phone || ""}</td>
                <td>{rupee(Number(employee.basicSalary || 0))}</td>
                <td>{rupee(Number(employee.expenseTotal || 0))}</td>
                <td>{rupee(Number(employee.totalPayable || employee.basicSalary || 0))}</td>
                <td>{employee.aadharNo || ""}</td>
                <td>{employee.address || ""}</td>
                <td><Status value={employee.isActive === false ? "inactive" : "active"} /></td>
                {(canEdit || canDeactivate) && (
                  <td className="actions">
                    {canEdit && <button className="iconButton" onClick={() => startEdit(employee)} title="Edit"><Pencil size={16} /></button>}
                    {canDeactivate && (employee.isActive === false ? (
                      <button className="iconButton good" onClick={() => setActive(employee, true)} title="Activate"><CheckCircle2 size={16} /></button>
                    ) : (
                      <button className="iconButton bad" onClick={() => setActive(employee, false)} title="Deactivate"><XCircle size={16} /></button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filteredEmployees.length} onPage={setPage} />
    </section>
  );
}

function EmployeeManager({ employees, onChanged, canManage }: { employees: User[]; onChanged: () => Promise<void>; canManage: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function createEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await api("/users", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password: "Employee@123",
        role: "employee",
        department: "General"
      })
    });
    setName("");
    setEmail("");
    await onChanged();
  }

  async function editEmployee(employee: User) {
    const name = await promptPopup("Employee name", employee.name, "Edit employee");
    if (!name) return;
    const email = await promptPopup("Employee email", employee.email, "Edit employee", "email");
    if (!email) return;
    await api(`/users/${employee.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, email, role: "employee" })
    });
    await onChanged();
  }

  async function deleteEmployee(employee: User) {
    if (!await confirmPopup(`Archive ${employee.name}?`, "Archive employee")) return;
    await api(`/users/${employee.id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <div className="masterBox">
      <div>
        <strong>Employees</strong>
        <div className="chips">
          {employees.length === 0 && <span className="muted">Create employee first, then employee dropdown will show names.</span>}
          {employees.map((employee) => (
            <span className="chip" key={employee.id}>
              {employee.name}
              {canManage && (
                <>
                  <button type="button" onClick={() => editEmployee(employee)} title="Edit"><Pencil size={13} /></button>
                  <button type="button" onClick={() => deleteEmployee(employee)} title="Archive"><Trash2 size={13} /></button>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
      {canManage && (
        <form className="masterForm" onSubmit={createEmployee}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee name" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Employee email" />
          <button className="primary compact">
            <Plus size={16} /> Add
          </button>
        </form>
      )}
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function UploadedFileButton({ fileName, available, onView }: { fileName: string; available: boolean; onView: () => void }) {
  return (
    <button
      type="button"
      className="fileViewButton"
      onClick={onView}
      disabled={!available}
      title={available ? `View ${fileName}` : "File data is unavailable for this older record"}
    >
      <Eye size={16} />
      <span>{fileName}</span>
    </button>
  );
}

function FilePreviewModal({ fileName, data, onClose }: { fileName: string; data: string; onClose: () => void }) {
  const mimeType = data.match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || "application/octet-stream";
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function download() {
    const link = document.createElement("a");
    link.href = data;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="filePreviewBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="filePreviewPanel" role="dialog" aria-modal="true" aria-label={`Preview ${fileName}`}>
        <header>
          <div><span className="eyebrow">Uploaded Proof</span><strong title={fileName}>{fileName}</strong></div>
          <div className="buttonRow">
            <button type="button" className="secondary compact" onClick={download}><Download size={16} /> Download</button>
            <button type="button" className="iconButton" onClick={onClose} title="Close"><XCircle size={18} /></button>
          </div>
        </header>
        <div className="filePreviewBody">
          {isImage && <img src={data} alt={fileName} />}
          {isPdf && !isImage && <iframe src={data} title={fileName} />}
          {!isImage && !isPdf && <div className="unsupportedPreview"><FileText size={54} /><strong>Preview is not available for this file type</strong><p>{mimeType}</p><button type="button" className="primary compact" onClick={download}><Download size={16} /> Download file</button></div>}
        </div>
      </div>
    </div>
  );
}

async function downloadServerPdf(path: string, fileName: string) {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toDateInputValue(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function formatDateTime(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN");
}

function withinDateRange(value: string | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function paginateRows<T>(rows: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

function sumRows<T extends Record<string, unknown>>(rows: T[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filterBar">{children}</div>;
}

function PermissionChecklist({
  title,
  options,
  values,
  onChange
}: {
  title: string;
  options: Array<{ id: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  return (
    <div className="permissionBox wide">
      <strong>{title}</strong>
      <div className="permissionGrid">
        {options.map((option) => (
          <label className="checkLine" key={option.id}>
            <input type="checkbox" checked={values.includes(option.id)} onChange={() => toggle(option.id)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="pagination">
      <span>{total} records</span>
      <div>
        <button className="secondary compact" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <strong>{page} / {totalPages}</strong>
        <button className="secondary compact" type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined && value !== null));
}

function formatCell(row: Record<string, unknown>, column: string, moneyColumn?: string) {
  const value = column.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, row);
  if (column === moneyColumn || column.toLowerCase().includes("amount") || column === "subtotal" || column === "credit" || column === "debit") return rupee(Number(value || 0));
  if (column === "timestamp" && typeof value === "string") return new Date(value).toLocaleString("en-IN");
  if (["date", "createdAt", "transferDate", "paymentDate"].includes(column) && typeof value === "string") return value.slice(0, 10);
  if (column === "isActive") return value === false ? "Deactive" : "Active";
  return String(value ?? "");
}

function RowActions({ onEdit, onDelete, deleteTitle = "Delete" }: { onEdit?: () => void; onDelete?: () => void; deleteTitle?: string }) {
  return (
    <>
      {onEdit && <button className="iconButton" onClick={onEdit} title="Edit">
        <Pencil size={16} />
      </button>}
      {onDelete && <button className="iconButton bad" onClick={onDelete} title={deleteTitle}>
        <Trash2 size={16} />
      </button>}
    </>
  );
}

function Status({ value }: { value: string }) {
  const tone = useMemo(() => {
    if (["approved", "posted", "verified", "paid", "issued"].includes(value)) return "green";
    if (["rejected", "cancelled"].includes(value)) return "red";
    return "amber";
  }, [value]);
  return <span className={`status ${tone}`}>{value.replaceAll("_", " ")}</span>;
}
