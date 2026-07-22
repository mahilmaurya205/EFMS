import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Expense } from "../models/Expense.js";
import { Voucher } from "../models/Voucher.js";
import { User } from "../models/User.js";
import { CashEntry } from "../models/CashEntry.js";
import { BankAccount } from "../models/BankAccount.js";
import { Earning } from "../models/Earning.js";
import { OperationalRecord } from "../models/OperationalRecord.js";
import { Transfer } from "../models/Transfer.js";
import { Payroll } from "../models/Payroll.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requirePermission("dashboard"));

dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [todayExpenseTotal, todayEarningTotal, totalExpense, totalEarning, cashEarningTotal, bankEarningTotal, officeCashExpenseTotal, officeBankExpenseTotal, cashVoucherTotal, bankVoucherTotal, cashToBankTotal, bankToCashTotal, users, vouchers, cashEntries, bankAccounts, bankRecords, salaryTotal, todaySalaryTotal] = await Promise.all([
      Expense.aggregate([{ $match: { createdAt: { $gte: start }, status: { $ne: "archived" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Earning.aggregate([{ $match: { createdAt: { $gte: start }, status: { $ne: "archived" } } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Expense.aggregate([{ $match: { status: { $ne: "archived" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Earning.aggregate([{ $match: { status: { $ne: "archived" } } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Earning.aggregate([{ $match: { status: { $ne: "archived" }, paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Earning.aggregate([{ $match: { status: { $ne: "archived" }, paymentMode: { $ne: "cash" } } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Expense.aggregate([{ $match: { status: { $ne: "archived" }, paidFrom: "office", paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Expense.aggregate([{ $match: { status: { $ne: "archived" }, paidFrom: "office", paymentMode: { $ne: "cash" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Voucher.aggregate([{ $match: { status: "issued", type: { $ne: "receipt" }, sourceType: { $ne: "payroll" }, paymentMode: "cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Voucher.aggregate([{ $match: { status: "issued", type: { $ne: "receipt" }, sourceType: { $ne: "payroll" }, paymentMode: { $ne: "cash" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transfer.aggregate([{ $match: { status: { $ne: "archived" }, type: "cash_to_bank" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transfer.aggregate([{ $match: { status: { $ne: "archived" }, type: "bank_to_cash" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      User.countDocuments(),
      Voucher.countDocuments({ sourceType: { $ne: "payroll" } }),
      CashEntry.find().lean(),
      BankAccount.find({ isArchived: false, isActive: { $ne: false } }).lean(),
      OperationalRecord.find({ module: "bank", status: { $ne: "archived" } }).lean(),
      Payroll.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$basicSalary" } } }]),
      Payroll.aggregate([{ $match: { status: "paid", paymentDate: { $gte: start } } }, { $group: { _id: null, total: { $sum: "$basicSalary" } } }])
    ]);

    const cashBookBalance = cashEntries.reduce((sum, entry) => {
      if (["received", "withdrawn"].includes(entry.type)) return sum + entry.amount;
      if (["spent", "deposit"].includes(entry.type)) return sum - entry.amount;
      return sum;
    }, 0);
    const cashInHand = cashBookBalance + (cashEarningTotal[0]?.total ?? 0) - (officeCashExpenseTotal[0]?.total ?? 0) - (cashVoucherTotal[0]?.total ?? 0) - (cashToBankTotal[0]?.total ?? 0) + (bankToCashTotal[0]?.total ?? 0);
    const bankBookBalance = bankRecords.reduce((sum, record) => {
      const status = record.status.toLowerCase();
      if (["credit", "received", "deposit", "active"].includes(status)) return sum + record.amount;
      if (["debit", "spent", "withdrawn", "payment"].includes(status)) return sum - record.amount;
      return sum;
    }, 0);
    const bankBalance = bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0) + (bankEarningTotal[0]?.total ?? 0) + bankBookBalance - (officeBankExpenseTotal[0]?.total ?? 0) - (bankVoucherTotal[0]?.total ?? 0) + (cashToBankTotal[0]?.total ?? 0) - (bankToCashTotal[0]?.total ?? 0);

    res.json({
      totalIncome: totalEarning[0]?.total ?? 0,
      totalExpense: (totalExpense[0]?.total ?? 0) + (salaryTotal[0]?.total ?? 0),
      todayIncome: todayEarningTotal[0]?.total ?? 0,
      todayExpense: (todayExpenseTotal[0]?.total ?? 0) + (todaySalaryTotal[0]?.total ?? 0),
      users,
      vouchers,
      cashInHand,
      bankBalance,
      totalBalance: bankBalance + cashInHand
    });
  })
);
