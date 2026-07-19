import mongoose, { Schema } from "mongoose";

const bankAccountSchema = new Schema(
  {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const BankAccount = mongoose.model("BankAccount", bankAccountSchema);
