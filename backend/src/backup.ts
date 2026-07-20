import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";

await connectDatabase();
const database = mongoose.connection.db;
if (!database) throw new Error("Database unavailable");
const outputDir = path.resolve(process.cwd(), "backups");
await fs.mkdir(outputDir, { recursive: true });
const collections: Record<string, unknown[]> = {};
for (const { name } of await database.listCollections().toArray()) {
  if (!name.startsWith("system.")) collections[name] = await database.collection(name).find({}).toArray();
}
const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const target = path.join(outputDir, `efms-${stamp}.json`);
await fs.writeFile(target, JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), collections }, null, 2), "utf8");
const files = (await fs.readdir(outputDir)).filter((file) => file.startsWith("efms-") && file.endsWith(".json")).sort().reverse();
await Promise.all(files.slice(14).map((file) => fs.unlink(path.join(outputDir, file))));
console.log(`Backup created: ${target}`);
await mongoose.disconnect();
