# Stripe Revenue Copilot — Stage 0

Bootable scaffold. Verify:
- `/` loads
- `/api/health` returns `{ ok: true }`

## Run
npm install
npx prisma generate
npm run dev

2. Stripe Revenue Copilot
Live URL: https://stripe-revenue-copilot.vercel.app
Code: https://github.com/fidelisnguakaaga20/stripe-revenue-copilot
Stack: Next.js 16 · Stripe · Prisma · Neon Postgres · Vercel

Summary:
Subscription analytics & admin toolkit. Real Stripe Checkout upgrades, webhook-driven DB sync, and recon jobs—built for production billing workflows.

What it shows:
- Checkout → webhook promotes org plan (FREE → PRO)
- Invoice & subscription upserts (idempotent) in Postgres
- Dev-only “sync-checkout” endpoint for local testing
- Cron reconcile to keep Stripe ↔ DB parity
- Secure dashboard with per-org plan badge
