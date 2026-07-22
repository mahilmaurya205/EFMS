import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

let app;
try {
  await connectDatabase();
  app = (await import("./app.js")).app;
} catch (error) {
  if (env.nodeEnv === "production") {
    console.error("EFMS cannot start in production without MongoDB.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  console.warn("Starting EFMS in local memory mode because MongoDB is unavailable.");
  console.warn("Data created in this mode is temporary and resets when the backend restarts.");
  app = (await import("./devMemoryApp.js")).createDevMemoryApp();
}

const server = app.listen(env.port, () => {
  console.log(`EFMS backend running on http://localhost:${env.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing HTTP server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
  shutdown("unhandledRejection");
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.port} is already in use.`);
    console.error("Stop the existing backend process, then run npm run dev again.");
    console.error(`PowerShell: Get-NetTCPConnection -LocalPort ${env.port} -State Listen`);
    process.exit(1);
  }

  throw error;
});
