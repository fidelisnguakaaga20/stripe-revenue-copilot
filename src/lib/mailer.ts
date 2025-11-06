// src/lib/mailer.ts
// Production-safe mailer using nodemailer.
// Uses MAIL_MOCK=false to send real email via SMTP defined in .env.

import nodemailer from "nodemailer";

const MAIL_MOCK = (process.env.MAIL_MOCK ?? "false").toLowerCase() === "true";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "Billing <no-reply@example.com>";
const SMTP_SECURE = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"; // true for 465

// Validate at startup if we intend to send real mail.
if (!MAIL_MOCK) {
  const missing: string[] = [];
  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_PORT) missing.push("SMTP_PORT");
  if (!SMTP_USER) missing.push("SMTP_USER");
  if (!SMTP_PASS) missing.push("SMTP_PASS");
  if (missing.length) {
    throw new Error(`[mailer] Missing required SMTP env: ${missing.join(", ")}`);
  }
}

const transporter = MAIL_MOCK
  ? null
  : nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // false for 587 (STARTTLS), true for 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

type SendArgs = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

export async function sendMail({ to, subject, html, text, from }: SendArgs) {
  if (MAIL_MOCK) {
    console.log("[mailer:mock]", { to, subject });
    return { mocked: true };
  }
  if (!transporter) throw new Error("SMTP transporter not configured");

  const info = await transporter.sendMail({
    from: from ?? MAIL_FROM,
    to,
    subject,
    text: text ?? (html ? "" : "(no text)"),
    html,
  });

  console.log("[mailer] sent", info.messageId);
  return { messageId: info.messageId };
}


