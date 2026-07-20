import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const key = createHash("sha256").update(env.dataEncryptionKey).digest();

export function encryptSensitive(value?: string) {
  if (!value || value.startsWith("enc:v1:")) return value ?? "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSensitive(value?: string) {
  if (!value?.startsWith("enc:v1:")) return value ?? "";
  try {
    const [, , iv, tag, encrypted] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "[encrypted data unavailable]";
  }
}
