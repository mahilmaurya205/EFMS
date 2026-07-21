import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendPasswordChangeOtp(input: { otp: string; adminName: string }) {
  if (!env.smtpUser || !env.smtpAppPassword || !env.passwordOtpRecipient) {
    throw new Error("Password OTP email is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.smtpUser, pass: env.smtpAppPassword }
  });

  await transporter.sendMail({
    from: `EFMS Security <${env.smtpUser}>`,
    to: env.passwordOtpRecipient,
    subject: "EFMS password change verification code",
    text: `Your EFMS password change OTP is ${input.otp}. It expires in 10 minutes. If you did not request this change, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #dbe3ef;border-radius:10px"><h2 style="color:#2563eb">EFMS Security Verification</h2><p>Hello ${input.adminName},</p><p>Use this one-time code to approve your Super Admin password change:</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:18px;text-align:center;background:#eff6ff;border-radius:8px;color:#0f172a">${input.otp}</div><p>This code expires in <strong>10 minutes</strong> and can be attempted a maximum of five times.</p><p style="color:#64748b">If you did not request this change, do not share this code and ignore this email.</p></div>`
  });
}
