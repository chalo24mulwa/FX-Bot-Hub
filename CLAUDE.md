@AGENTS.md

# FX Bot Market

A Forex EA/indicator marketplace with an integrated economic calendar. Structural
reference points: MQL5 Market (catalog model), Forex Factory Calendar (filtering),
TradingView Economic Calendar (data presentation).

## Ground rule for every phase

**Do not rebuild the application between phases. Extend the existing architecture.
Never delete or replace working features unless explicitly instructed.** Phase 1
(this scaffold) exists so later phases add capabilities instead of re-deriving the
foundation — read this file and `README.md` before making structural changes.

## Architecture at a glance

- Next.js (App Router) + TypeScript, `src/app` for routes, `src/components/ui` for
  primitives, `src/lib` for cross-cutting concerns, `src/server/services` for
  business logic that route handlers and Server Components both call into.
- PostgreSQL via Prisma (`prisma/schema.prisma`) — pinned to **Prisma 6.19.3**, not
  the `latest` npm tag. Prisma 7 changed the config model (driver adapters required,
  no `datasource.url`); don't upgrade without deliberately migrating to that model.
- Auth.js v5 (`next-auth@beta`) in `src/lib/auth.ts`, Credentials provider + Prisma
  adapter, JWT sessions. Route protection lives in `src/proxy.ts` (Next 16 renamed
  `middleware.ts` → `proxy.ts`; don't recreate the old file).
- **Provider abstractions — extend by adding a case, not by rewriting the caller:**
  - `src/lib/payments/` — `PaymentProvider` interface. `manual-provider.ts` is the
    working default (marks orders paid instantly, for dev only). `stripe-provider.ts`
    and `mpesa-provider.ts` are typed stubs for Phase 2.
  - `src/lib/storage/` — `StorageProvider` interface backed by any S3-compatible
    service (AWS S3, R2, MinIO). Local dev uses the MinIO service in
    `docker-compose.yml`.
  - `src/lib/email/` — `EmailProvider` interface. `console-provider.ts` (default)
    logs instead of sending; `resend-provider.ts` is real, gated on `RESEND_API_KEY`.
- `src/lib/queue/` — BullMQ queues + a worker entrypoint (`workers/email-worker.ts`,
  run via `npm run worker:email`). Add new background jobs as new queues here, not
  as inline async work in request handlers.
- Economic calendar (`economic_events` table, `/calendar`, `/api/calendar`) is
  seeded manually for Phase 1. Phase 2 wires `calendarSyncQueue` to a real provider.

## Commands

- `npm run dev` / `npm run build` / `npm run test` (Vitest) / `npm run test:e2e`
  (Playwright) / `npm run typecheck` / `npm run lint`
- `npm run db:migrate` (dev migration), `npm run db:seed`, `npm run db:studio`
- `docker compose up` starts Postgres, Redis, and MinIO for local dev — copy
  `.env.example` to `.env` first.

## Known follow-ups (intentionally deferred, not oversights)

- Checkout has no real payment UI yet — `PAYMENT_PROVIDER=manual` marks orders paid
  synchronously so the buy flow is testable before Stripe/M-Pesa are implemented.
- License-key issuance on purchase, vendor payouts, and the vendor dashboard are not
  built yet — the `License`/`VendorProfile` models exist in the schema for this.
- Full-text search is Postgres `ILIKE` for now; the plan is Postgres full-text search
  next, then Elasticsearch/OpenSearch if the catalog outgrows it.
