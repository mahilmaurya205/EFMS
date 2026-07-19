import mongoose, { Schema } from "mongoose";

const transferSchema = new Schema(
  {
    type: { type: String, enum: ["cash_to_bank", "bank_to_cash"], required: true },
    amount: { type: Number, required: true, min: 1 },
    bankAccount: { type: String, required: true },
    referenceNo: { type: String, default: "" },
    remarks: { type: String, default: "" },
    transferDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "archived"], default: "active" }
  },
  { timestamps: true }
);

transferSchema.index({ type: 1, transferDate: -1 });

export const Transfer = mongoose.model("Transfer", transferSchema);
