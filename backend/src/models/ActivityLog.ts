import mongoose, { Schema } from "mongoose";

const activityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceType: { type: String },
    browser: { type: String },
    os: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    reason: { type: String }
    ,previousHash: { type: String, default: "" }
    ,integrityHash: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

activityLogSchema.index({ action: 1, createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
