import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import { User } from "./models/User.js";

const email = "admin@efms.local";
const password = "Htech@2026#";

await connectDatabase();

const user = await User.findOneAndUpdate(
  { email },
  {
    $set: {
      passwordHash: await bcrypt.hash(password, 12),
      isActive: true
    },
    $setOnInsert: {
      name: "EFMS Admin",
      email,
      role: "super_admin",
      department: "Finance"
    }
  },
  { new: true, upsert: true }
);

console.log(`Super Admin password updated for ${user.email}`);
await mongoose.disconnect();
