import mongoose, { Schema } from "mongoose";

const masterOptionSchema = new Schema(
  {
    type: { type: String, enum: ["expense_category", "earning_source", "project"], required: true },
    name: { type: String, required: true, trim: true },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

masterOptionSchema.index({ type: 1, name: 1 }, { unique: true });

export const MasterOption = mongoose.model("MasterOption", masterOptionSchema);
