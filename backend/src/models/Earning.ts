import mongoose, { Schema } from "mongoose";

const earningSchema = new Schema(
  {
    source: { type: String, required: true, trim: true },
    project: { type: String, default: "" },
    customer: { type: String, required: true, trim: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    paymentMode: { type: String, enum: ["cash", "bank", "upi", "cheque", "other"], required: true },
    bankAccount: { type: String },
    referenceNo: { type: String },
    remarks: { type: String, default: "" },
    gstApplicable: { type: Boolean, default: true },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "partial", "paid", "archived"], default: "pending" }
  },
  { timestamps: true }
);

earningSchema.index({ status: 1, createdAt: -1 });
earningSchema.index({ customer: 1, createdAt: -1 });

export const Earning = mongoose.model("Earning", earningSchema);
