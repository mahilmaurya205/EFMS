import mongoose, { Schema } from "mongoose";

const approvalStepSchema = new Schema(
  {
    order: { type: Number, required: true },
    role: { type: String, required: true },
    approverId: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    comment: { type: String },
    actedAt: { type: Date }
  },
  { _id: false }
);

const expenseSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    purpose: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    vendor: { type: String },
    expectedDate: { type: Date, required: true },
    remarks: { type: String, default: "" },
    paidFrom: { type: String, enum: ["office", "employee"], default: "office" },
    spentByEmployeeId: { type: Schema.Types.ObjectId, ref: "User" },
    spentByEmployeeName: { type: String },
    paymentMode: { type: String, enum: ["cash", "cheque", "upi", "bank", "card", "other"], default: "cash" },
    bankAccount: { type: String, default: "" },
    proofFileName: { type: String },
    proofData: { type: String },
    paidByEmployee: { type: Boolean, default: false },
    quotationUrl: { type: String },
    invoiceUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "entered", "pending_approval", "approved", "needs_info", "rejected", "verified", "posted", "closed", "archived"],
      default: "draft"
    },
    approvalSteps: [approvalStepSchema],
    currentStep: { type: Number, default: 0 },
    rejectionReason: { type: String },
    voucherId: { type: Schema.Types.ObjectId, ref: "Voucher" },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" }
  },
  { timestamps: true }
);

expenseSchema.index({ status: 1, createdAt: -1 });
expenseSchema.index({ employeeId: 1, createdAt: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
