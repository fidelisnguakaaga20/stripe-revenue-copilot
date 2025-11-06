// src/lib/env.ts
export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV ?? "development",

  /// NEW: SMTP for dunning mailer
  SMTP_HOST: process.env.SMTP_HOST ?? "",          /// NEW
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587), /// NEW
  SMTP_USER: process.env.SMTP_USER ?? "",          /// NEW
  SMTP_PASS: process.env.SMTP_PASS ?? "",          /// NEW
  SMTP_FROM: process.env.SMTP_FROM ?? "",          /// NEW

  /// NEW: header key for cron endpoints (reconcile already uses it)
  CRON_SECRET: process.env.CRON_SECRET ?? "",      /// NEW
};
