import mongoose, { Schema } from "mongoose";

const advanceExpenseSchema = new Schema(
  {
    expenseDate: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    vendor: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMode: { type: String, enum: ["cash", "upi", "bank", "card", "other"], default: "cash" },
    referenceNo: { type: String, default: "", trim: true },
    remarks: { type: String, default: "" },
    proofFileName: { type: String },
    proofData: { type: String },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const advanceRefundSchema = new Schema(
  {
    refundDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    mode: { type: String, enum: ["cash", "bank"], required: true },
    bankAccount: { type: String, default: "" },
    referenceNo: { type: String, default: "" },
    remarks: { type: String, default: "" },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const fundAdvanceSchema = new Schema(
  {
    advanceNumber: { type: String, required: true, unique: true },
    recipientType: { type: String, enum: ["employee", "other"], required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User" },
    recipientName: { type: String, required: true, trim: true },
    recipientPhone: { type: String, default: "", trim: true },
    purpose: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    source: { type: String, enum: ["cash", "bank"], required: true },
    bankAccount: { type: String, default: "" },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date },
    referenceNo: { type: String, default: "" },
    remarks: { type: String, default: "" },
    status: { type: String, enum: ["open", "settled", "archived"], default: "open" },
    expenses: [advanceExpenseSchema],
    refunds: [advanceRefundSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

fundAdvanceSchema.index({ status: 1, issueDate: -1 });
fundAdvanceSchema.index({ employeeId: 1, issueDate: -1 });

export const FundAdvance = mongoose.model("FundAdvance", fundAdvanceSchema);
