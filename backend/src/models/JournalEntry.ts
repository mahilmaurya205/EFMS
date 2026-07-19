import mongoose, { Schema } from "mongoose";

const journalLineSchema = new Schema(
  {
    account: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  },
  { _id: false }
);

const journalEntrySchema = new Schema(
  {
    voucherId: { type: Schema.Types.ObjectId, ref: "Voucher", required: true },
    entryDate: { type: Date, default: Date.now },
    description: { type: String, required: true },
    lines: [journalLineSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

journalEntrySchema.pre("validate", function (next) {
  const debit = this.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = this.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (debit !== credit) return next(new Error("Journal entry must balance debit and credit"));
  next();
});

export const JournalEntry = mongoose.model("JournalEntry", journalEntrySchema);
