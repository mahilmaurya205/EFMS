import mongoose, { Schema } from "mongoose";

const voucherSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["payment", "receipt", "journal", "contra", "refund", "salary", "advance", "expense"],
      required: true
    },
    voucherNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    purpose: { type: String, required: true },
    receiver: { type: String },
    paymentMode: { type: String, enum: ["cash", "cheque", "upi", "bank", "card", "other"], default: "cash" },
    bankAccount: { type: String, default: "" },
    referenceNo: { type: String },
    remarks: { type: String, default: "" },
    givenBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceType: { type: String },
    sourceId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["issued", "cancelled", "archived"], default: "issued" },
    cancelReason: { type: String },
    pdfUrl: { type: String }
  },
  { timestamps: true }
);

voucherSchema.index({ type: 1, voucherNumber: 1 }, { unique: true });

export const Voucher = mongoose.model("Voucher", voucherSchema);
