# FX Bot Market

A Forex Expert Advisor / indicator marketplace with an integrated economic
calendar — structurally inspired by MQL5 Market (catalog), Forex Factory Calendar
(filtering), and TradingView's Economic Calendar (data presentation).

See [CLAUDE.md](./CLAUDE.md) for the architecture map and the ground rule that
governs every future phase: **extend this foundation, don't rebuild it.**

## Stack

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · Redis + BullMQ ·
Auth.js v5 (credentials + optional Google OAuth) · Tailwind CSS · shadcn/ui-style
primitives · Zod · S3-compatible storage (presigned direct uploads) · pluggable
payment/email/search providers · centralized RBAC (`USER`/`SELLER`/`AUTHOR`/
`MODERATOR`/`ADMIN`/`SUPER_ADMIN`) · cart/checkout/licensing · Playwright e2e
against a real production build. Full rationale in CLAUDE.md.

## Feature tour

- **Buyers**: browse/search/filter, favorite, add to cart, check out, download
  owned files, leave verified-purchase reviews.
- **Sellers** (`/seller`): a 12-step product creation wizard (type → platform →
  basic info → description → features → screenshots → documentation → files →
  pricing → compatibility → testing/support → submit for review), order/sales/
  revenue dashboard, per-product analytics, customer list, review responses,
  profile & payout settings.
- **Admins** (`/admin`): moderation queue (claim → approve/reject-with-reason/
  suspend/feature), user role & ban management, review moderation, category
  management, marketplace settings (commission, ranking weights), Phase 3's
  calendar/news/news-categories/signal-providers/signals/data-sources
  management, and Phase 4's finance dashboard, refunds, payouts, licenses,
  and security-event log.
- **Economic calendar** (`/calendar`): Today/Tomorrow/This Week/Next Week/
  custom-date presets, filters by currency/country/impact/category
  (saveable as a signed-in user's default), per-currency (`/calendar/[currency]`)
  and per-event (`/calendar/event/[id]`) pages with historical observations
  and an event/currency alert subscribe button. Backed by a swappable
  provider architecture (`manual` today, a `licensed-feed` stub for later)
  synced via a BullMQ job — see CLAUDE.md's "Phase 3" section.
- **Forex news** (`/news`): source-attributed summaries (never full-article
  copies), filterable by category/breaking, with a per-category alert
  subscribe button on each article.
- **Forex signals** (`/signals`): become a provider, publish BUY/SELL/WATCH
  calls with entry/stop/take-profit and reasoning, a public provider profile
  with a self-reported-vs-admin-verified performance distinction, and
  FREE/paid subscriptions billed through the same payment abstraction as
  marketplace checkout.
- **Alerts** (`/dashboard/alerts`): subscribe to economic events, currencies,
  signal providers, or news categories from anywhere in the app; economic
  event reminders fire 30 minutes ahead via a scheduled job.
- **Market intelligence dashboard** (`/intelligence`): a modular overview
  combining upcoming high-impact events, latest news, and newest marketplace
  products in one place.
- **Commercial infrastructure** (Phase 4): a `PaymentService` wrapping the
  same pluggable `PaymentProvider` (`createCharge`/`parseWebhook`/
  `refundCharge`) behind a webhook endpoint (`POST /api/payments/webhook`)
  and client-supplied idempotency keys, so a payment is never trusted from
  a frontend "success" page alone. Product subscriptions (recurring
  billing via `npm run subscriptions:renew`) alongside one-time purchases;
  real license activation tracking (`/dashboard/licenses`,
  `/api/licenses/{verify,activate,deactivate}`) with per-machine slots, not
  just a counter; seller commissions computed against an admin-configurable
  rate into an append-only payout ledger (`/seller/payout`); a refund
  workflow that reverses licenses/subscriptions/ledger entries together
  (`/admin/refunds`); printable invoices (`/invoices/[id]`); and a
  fraud/security event log (`/admin/security`) that only ever signals for
  an admin to review — never auto-bans anyone. See CLAUDE.md's "Phase 4"
  section for the full design.

## Local development

1. Copy the env file and fill in secrets:

   ```bash
   cp .env.example .env
   ```

2. Start Postgres, Redis, and MinIO (S3-compatible storage):

   ```bash
   docker compose up -d db redis minio
   ```

3. Install dependencies, apply migrations, seed demo data:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000). Seeded logins (password
   `password123` for all): `vendor@fxbotmarket.local` (SELLER),
   `buyer@fxbotmarket.local` (USER), `moderator@fxbotmarket.local` (ADMIN),
   `admin@fxbotmarket.local` (SUPER_ADMIN). Try the seller flow at `/seller`,
   admin moderation at `/admin/products`. File uploads (screenshots,
   documentation, product files) need the `minio` service running — see Docker
   below — since they upload directly to object storage via a presigned URL.

## Scripts

| Command                | Purpose                                    |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | Start the Next.js dev server                |
| `npm run build`         | Production build                            |
| `npm run typecheck`     | `tsc --noEmit`                              |
| `npm run lint`          | ESLint                                      |
| `npm run test`          | Unit tests (Vitest)                         |
| `npm run test:e2e`      | End-to-end tests (Playwright)                |
| `npm run db:migrate`    | Create/apply a dev migration                |
| `npm run db:seed`       | Seed demo vendor, product, calendar event   |
| `npm run db:studio`     | Open Prisma Studio                          |
| `npm run worker:email`  | Run the BullMQ email worker                 |
| `npm run worker:calendar-sync` | Run the economic calendar sync worker |
| `npm run worker:news-sync` | Run the news sync worker                 |
| `npm run worker:market-data-sync` | Run the market data sync worker (stub) |
| `npm run worker:event-reminder` | Run the scheduled event-reminder worker |
| `npm run worker:subscription-renewal` | Run the product-subscription renewal worker |
| `npm run sync:trigger`  | Enqueue one calendar+news+market-data sync pass and exit |
| `npm run subscriptions:renew` | Enqueue one product-subscription renewal pass and exit |

## Docker

`docker compose up` builds and runs the full stack (Postgres, Redis, MinIO, and
the app itself via the multi-stage `Dockerfile`) for a production-like environment.

## Deployment

The Dockerfile produces a minimal standalone image (`output: "standalone"` in
`next.config.ts`) suitable for any container platform. `.github/workflows/ci.yml`
runs lint, typecheck, unit tests, e2e tests, and a production build on every push
and pull request.
