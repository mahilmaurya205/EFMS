import mongoose, { Schema } from "mongoose";

const approvalRuleSchema = new Schema(
  {
    name: { type: String, required: true },
    appliesTo: { type: String, enum: ["expense", "refund", "purchase"], required: true },
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number },
    approverRoles: [{ type: String, required: true }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ApprovalRule = mongoose.model("ApprovalRule", approvalRuleSchema);
