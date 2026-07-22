import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import { User } from "./models/User.js";

const adminEmail = "admin@efms.local";
const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
if (!adminPassword || adminPassword.length < 12) throw new Error("ADMIN_INITIAL_PASSWORD of at least 12 characters is required");

await connectDatabase();

const database = mongoose.connection.db;
if (!database) throw new Error("Database connection is unavailable");
if (["admin", "local", "config"].includes(database.databaseName)) {
  throw new Error(`Refusing to reset protected database: ${database.databaseName}`);
}

console.log(`Resetting EFMS application database: ${database.databaseName}`);

const collections = await database.listCollections().toArray();
for (const { name } of collections) {
  if (name.startsWith("system.")) continue;
  if (name === User.collection.collectionName) {
    await database.collection(name).deleteMany({ email: { $ne: adminEmail } });
    continue;
  }
  await database.collection(name).deleteMany({});
}

const passwordHash = await bcrypt.hash(adminPassword, 12);
await User.findOneAndUpdate(
  { email: adminEmail },
  {
    $set: {
      name: "EFMS Admin",
      email: adminEmail,
      passwordHash,
      role: "super_admin",
      department: "Finance",
      isActive: true,
      twoFactorEnabled: false
    },
    $unset: {
      twoFactorSecret: 1,
      twoFactorPendingSecret: 1,
      managerId: 1
    }
  },
  { upsert: true, new: true }
);

const remaining: Record<string, number> = {};
for (const { name } of await database.listCollections().toArray()) {
  if (!name.startsWith("system.")) remaining[name] = await database.collection(name).countDocuments();
}

const adminCount = await User.countDocuments({ email: adminEmail, role: "super_admin", isActive: true });
const userCount = await User.countDocuments();
if (adminCount !== 1 || userCount !== 1) throw new Error("Reset verification failed: expected exactly one active Super Admin");

console.log("Reset complete. Remaining collection counts:");
console.log(JSON.stringify(remaining, null, 2));
console.log(`Preserved login: ${adminEmail}`);

await mongoose.disconnect();
