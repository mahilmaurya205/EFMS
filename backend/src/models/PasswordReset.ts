import mongoose, { Schema } from "mongoose";

const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date }
  },
  { timestamps: true }
);

export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
