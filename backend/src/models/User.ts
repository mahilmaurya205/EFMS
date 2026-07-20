import mongoose, { Schema } from "mongoose";

export type UserRole = "super_admin" | "employee" | string;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "employee", trim: true },
    department: { type: String, default: "General" },
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    phone: { type: String, default: "" },
    aadharNo: { type: String, default: "" },
    address: { type: String, default: "" },
    designation: { type: String, default: "" },
    joiningDate: { type: Date },
    basicSalary: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
    ,twoFactorEnabled: { type: Boolean, default: false }
    ,twoFactorSecret: { type: String, select: false }
    ,twoFactorPendingSecret: { type: String, select: false }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
