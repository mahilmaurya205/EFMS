import mongoose, { Schema } from "mongoose";

const budgetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    category: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    limit: { type: Number, required: true, min: 0 },
    alert80Sent: { type: Boolean, default: false },
    alert100Sent: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

budgetSchema.index({ month: 1, category: 1, department: 1, isArchived: 1 });

export const Budget = mongoose.model("Budget", budgetSchema);
