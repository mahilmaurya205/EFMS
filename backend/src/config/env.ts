import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI ?? "",
  nodeDnsServers: (process.env.NODE_DNS_SERVERS ?? "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  refreshSecret: process.env.REFRESH_SECRET ?? process.env.JWT_SECRET ?? "dev-refresh-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  exposeResetToken: process.env.NODE_ENV !== "production"
  ,dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "dev-data-key-change-me"
  ,smtpUser: process.env.SMTP_USER ?? ""
  ,smtpAppPassword: (process.env.SMTP_APP_PASSWORD ?? "").replaceAll(" ", "")
  ,passwordOtpRecipient: process.env.PASSWORD_OTP_RECIPIENT ?? ""
};

if (!env.mongodbUri) {
  throw new Error("MONGODB_URI is required");
}
