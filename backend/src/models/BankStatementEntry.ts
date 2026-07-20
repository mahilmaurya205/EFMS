import mongoose, { Schema } from "mongoose";

const bankStatementEntrySchema = new Schema(
  {
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    transactionDate: { type: Date, required: true },
    description: { type: String, required: true, trim: true },
    reference: { type: String, default: "", trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    balance: { type: Number },
    importBatch: { type: String, required: true },
    fingerprint: { type: String, required: true, unique: true },
    matchType: { type: String, enum: ["earning", "expense", "voucher", "transfer", "manual", ""], default: "" },
    matchedRecordId: { type: String, default: "" },
    matchedAt: { type: Date },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

bankStatementEntrySchema.index({ bankAccount: 1, transactionDate: -1, isArchived: 1 });

export const BankStatementEntry = mongoose.model("BankStatementEntry", bankStatementEntrySchema);
