import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import { User } from "./models/User.js";

await connectDatabase();

const database = mongoose.connection.db;
if (!database) throw new Error("Database connection is unavailable");
if (["admin", "local", "config"].includes(database.databaseName)) {
  throw new Error(`Refusing to reset protected database: ${database.databaseName}`);
}

console.log(`Resetting EFMS application database: ${database.databaseName}`);

const admins = await User.find({ role: "super_admin", isActive: true }).select("_id email").lean();
if (admins.length !== 1) throw new Error(`Refusing reset: expected exactly one active Super Admin, found ${admins.length}`);
const admin = admins[0];

const collections = await database.listCollections().toArray();
for (const { name } of collections) {
  if (name.startsWith("system.")) continue;
  if (name === User.collection.collectionName) {
    await database.collection(name).deleteMany({ _id: { $ne: admin._id } });
    continue;
  }
  await database.collection(name).deleteMany({});
}

const remaining: Record<string, number> = {};
for (const { name } of await database.listCollections().toArray()) {
  if (!name.startsWith("system.")) remaining[name] = await database.collection(name).countDocuments();
}

const adminCount = await User.countDocuments({ _id: admin._id, role: "super_admin", isActive: true });
const userCount = await User.countDocuments();
if (adminCount !== 1 || userCount !== 1) throw new Error("Reset verification failed: expected exactly one active Super Admin");

console.log("Reset complete. Remaining collection counts:");
console.log(JSON.stringify(remaining, null, 2));
console.log(`Preserved login: ${admin.email}`);

await mongoose.disconnect();
