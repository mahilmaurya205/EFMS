import mongoose, { Schema } from "mongoose";

const operationalRecordSchema = new Schema(
  {
    module: {
      type: String,
      enum: ["cash", "bank", "refund", "salary", "document", "report", "setting"],
      required: true
    },
    title: { type: String, required: true },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "active" },
    remarks: { type: String, default: "" },
    fields: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

operationalRecordSchema.index({ module: 1, status: 1, createdAt: -1 });

export const OperationalRecord = mongoose.model("OperationalRecord", operationalRecordSchema);
