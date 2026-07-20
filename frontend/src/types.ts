export type Expense = {
  _id: string;
  employeeId: { name: string; email: string } | string;
  category: string;
  purpose: string;
  amount: number;
  vendor?: string;
  expectedDate: string;
  paidFrom?: "office" | "employee";
  spentByEmployeeId?: string;
  spentByEmployeeName?: string;
  paymentMode?: "cash" | "cheque" | "upi" | "bank" | "card" | "other";
  bankAccount?: string;
  proofFileName?: string;
  proofData?: string;
  paidByEmployee: boolean;
  remarks?: string;
  status: string;
  currentStep: number;
  approvalSteps: Array<{ order: number; role: string; status: string; comment?: string }>;
  voucherId?: string;
  createdAt: string;
};

export type Voucher = {
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

export type Invoice = {
  _id: string;
  type: string;
  invoiceNumber: string;
  customer: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: string;
  remarks?: string;
  createdAt: string;
  customerGst?: string;
  lines?: Array<{ description: string; quantity: number; unitPrice: number; gstRate: number }>;
};

export type Earning = {
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

export type BankAccount = {
  _id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  isActive?: boolean;
  isArchived?: boolean;
  createdAt: string;
};

export type Transfer = {
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

export type RoleOption = {
  _id: string;
  name: string;
  description?: string;
  sidebarPermissions?: string[];
  dashboardPermissions?: string[];
  isActive: boolean;
  isArchived?: boolean;
  createdAt: string;
};

export type OperationalRecord = {
  _id: string;
  module: string;
  title: string;
  amount: number;
  status: string;
  remarks: string;
  fields: Record<string, unknown>;
  createdAt: string;
};

export type MasterOption = {
  _id: string;
  type: "expense_category" | "earning_source" | "project";
  name: string;
  isArchived?: boolean;
  createdAt: string;
};

export type Budget = {
  _id: string;
  name: string;
  month: string;
  category?: string;
  department?: string;
  limit: number;
  spent: number;
  remaining: number;
  utilization: number;
  alert: "ok" | "warning" | "exceeded";
};

export type StatementEntry = {
  _id: string;
  bankAccount: BankAccount | string;
  transactionDate: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  balance?: number;
  matchType?: string;
  matchedRecordId?: string;
};
