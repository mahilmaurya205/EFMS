import mongoose, { Schema } from "mongoose";

const cashEntrySchema = new Schema(
  {
    businessDate: { type: Date, required: true },
    type: { type: String, enum: ["received", "spent", "withdrawn", "deposit", "adjustment"], required: true },
    amount: { type: Number, required: true, min: 0 },
    purpose: { type: String, required: true },
    voucherId: { type: Schema.Types.ObjectId, ref: "Voucher" },
    doneBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

cashEntrySchema.index({ businessDate: 1, createdAt: -1 });

export const CashEntry = mongoose.model("CashEntry", cashEntrySchema);
