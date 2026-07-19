import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./env.js";

export async function connectDatabase() {
  if (env.nodeDnsServers.length > 0) {
    dns.setServers(env.nodeDnsServers);
  }

  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.mongodbUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("MongoDB connection failed.");
    console.error("Check MongoDB Atlas Network Access and allow this machine's public IP.");
    console.error(message);
    throw error;
  }
  console.log("MongoDB connected");
}
