import mongoose, { Schema } from "mongoose";

const payrollSchema = new Schema({
  payrollNumber: { type: String, required: true, unique: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  salaryMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  basicSalary: { type: Number, required: true, min: 0 },
  reimbursementAmount: { type: Number, required: true, min: 0, default: 0 },
  totalPaid: { type: Number, required: true, min: 0 },
  includeExpenses: { type: Boolean, default: false },
  expenseIds: [{ type: Schema.Types.ObjectId, ref: "Expense" }],
  paymentMode: { type: String, enum: ["cash", "bank"], required: true },
  bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
  bankAccount: { type: String, default: "" },
  referenceNo: { type: String, default: "" },
  paymentDate: { type: Date, required: true },
  remarks: { type: String, default: "" },
  voucherId: { type: Schema.Types.ObjectId, ref: "Voucher" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["paid", "cancelled"], default: "paid" }
}, { timestamps: true });

payrollSchema.index({ employeeId: 1, salaryMonth: 1 }, { unique: true, partialFilterExpression: { status: "paid" } });
export const Payroll = mongoose.model("Payroll", payrollSchema);
