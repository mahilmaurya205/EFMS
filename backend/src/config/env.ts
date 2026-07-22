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
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean),
  exposeResetToken: process.env.NODE_ENV !== "production"
  ,dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "dev-data-key-change-me"
  ,smtpUser: process.env.SMTP_USER ?? ""
  ,smtpAppPassword: (process.env.SMTP_APP_PASSWORD ?? "").replaceAll(" ", "")
  ,passwordOtpRecipient: process.env.PASSWORD_OTP_RECIPIENT ?? ""
  ,companyName: process.env.COMPANY_NAME ?? "Htech Solutions Pvt. Ltd."
  ,companyGstin: process.env.COMPANY_GSTIN ?? ""
  ,companyAddress: process.env.COMPANY_ADDRESS ?? ""
  ,companyEmail: process.env.COMPANY_EMAIL ?? ""
  ,verifyBaseUrl: process.env.VERIFY_BASE_URL ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173"
};

if (!env.mongodbUri) {
  throw new Error("MONGODB_URI is required");
}

if (env.nodeEnv === "production") {
  const secrets = [
    ["JWT_SECRET", env.jwtSecret],
    ["REFRESH_SECRET", env.refreshSecret],
    ["DATA_ENCRYPTION_KEY", env.dataEncryptionKey]
  ] as const;
  for (const [name, value] of secrets) {
    if (value.length < 32 || value.includes("change-me") || value.includes("dev-secret")) {
      throw new Error(`${name} must be an independent random value of at least 32 characters in production`);
    }
  }
  if (new Set(secrets.map(([, value]) => value)).size !== secrets.length) {
    throw new Error("JWT_SECRET, REFRESH_SECRET, and DATA_ENCRYPTION_KEY must be different in production");
  }
  if (!env.clientOrigins.every((origin) => origin.startsWith("https://"))) {
    throw new Error("CLIENT_ORIGIN must contain HTTPS origins only in production");
  }
}
