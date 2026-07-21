import mongoose, { Schema } from "mongoose";

const passwordChangeOtpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    otpHash: { type: String, required: true },
    pendingPasswordHash: { type: String, required: true },
    recipient: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }
  },
  { timestamps: true }
);

export const PasswordChangeOtp = mongoose.model("PasswordChangeOtp", passwordChangeOtpSchema);
