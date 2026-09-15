# Architecture overview

This is the human-facing architecture summary. `CLAUDE.md` is the detailed,
phase-by-phase build log (written for whoever — human or AI — extends this
codebase next, with the specific reasoning behind non-obvious decisions);
this document is the higher-level map. Read `CLAUDE.md` before making a
structural change; read this one to get oriented first.

## System shape

```
                          ┌─────────────────────┐
                          │   Next.js App        │
   Browser  ───────────▶  │  (App Router, RSC)    │
                          │                       │
                          │  Pages / API routes   │
                          │  Server Actions        │
                          └──────────┬────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              ▼                      ▼                       ▼
      ┌───────────────┐     ┌───────────────┐       ┌────────────────┐
      │  PostgreSQL    │     │     Redis      │       │ Object storage  │
      │  (Prisma)      │     │ cache / rate-  │       │ (S3-compatible) │
      │                │     │ limit / BullMQ │       │ product files/   │
      │  system of     │     │ queues         │       │ images (presigned│
      │  record        │     │                │       │ upload/download) │
      └───────────────┘     └───────┬───────┘       └────────────────┘
                                     │
                             ┌───────▼────────┐
                             │  BullMQ workers  │
                             │ (separate procs) │
                             │  email, calendar/│
                             │  news sync, event │
                             │  reminders, sub   │
                             │  renewals         │
                             └───────────────────┘
```

Everything reachable from a browser request goes through the Next.js app;
Postgres is the only hard dependency (if it's down, the app is down — see
`docs/OBSERVABILITY.md`). Redis and object storage are both designed to
degrade gracefully rather than take the app down if unreachable.

## Request flow

1. **Edge**: `src/proxy.ts` (Next 16's renamed middleware) gates
   `/admin`, `/seller`, `/dashboard` before anything renders.
2. **Server Components** (`src/app/**/page.tsx`) do the actual data
   fetching for most pages — directly via Prisma (`src/lib/db.ts`) or
   through a `src/features/<domain>/` service function, never through the
   app's own `/api` routes (that would be an unnecessary network hop for
   server-to-server data the same process can just query).
3. **Mutations** go through either:
   - **Server Actions** (`src/features/*/actions.ts`) — the default for
     anything triggered from a Client Component form/button; gets
     same-origin CSRF protection from Next.js for free.
   - **`/api` routes** (`src/app/api/**/route.ts`) — for anything an
     external client needs (webhooks, license verification, search) or
     that predates the Server Action convention; these call
     `assertSameOrigin()` manually. See `docs/API.md`.
4. **Authorization** is checked at up to three layers for anything
   sensitive (edge, layout, action/route) — see `docs/SECURITY.md`.

## Code layout

- `src/app/` — routes (pages + API routes), following Next.js App Router
  file conventions.
- `src/components/` — `ui/` (primitives), then domain-grouped
  (`marketplace/`, `admin/`, `seller/`, `calendar/`, `signals/`,
  `commerce/`, etc.).
- `src/lib/` — cross-cutting infrastructure: auth, db, redis, cache,
  logger, security (CSRF/rate-limit/fraud), payments, storage, email,
  search, ranking, commerce math, quality scoring, AI-readiness
  interfaces, queue definitions.
- `src/features/<domain>/` — business logic per capability (checkout,
  refunds, payouts, licenses, reviews, favorites, signals, alerts,
  calendar, news, analytics, admin). Each domain's `actions.ts` (where
  present) holds its Server Actions.
- `src/repositories/` — thin, reusable Prisma query modules (the one
  place a given filter/query-builder shape should live, not re-implemented
  per page).
- `src/server/services/` — the original (Phase 1) product/auth service
  layer; kept distinct from `src/features/` mostly for historical reasons
  — see `CLAUDE.md`'s "Service layout" section for the actual boundary.
- `src/services/<domain>/` — external-data-facing services with a
  provider-adapter pattern (calendar, news, market-data, subscriptions) —
  distinct from `src/server/services/` (naming collision worth knowing
  about; see `CLAUDE.md`).
- `e2e/` — Playwright specs, run against a real production build.
- `*.test.ts` colocated with the code they test — Vitest, pure-logic only
  (no database).

## The provider-adapter pattern

Used consistently for anything that has (or might have) more than one
backing implementation — **this is the main extension point in this
codebase**. Each follows the same shape: a typed interface, a working
default implementation, a registry/singleton export, and — where a real
implementation doesn't exist yet — a typed stub that throws "not
configured" rather than silently doing nothing:

| Concern | Interface | Working default | Stub(s) |
| --- | --- | --- | --- |
| Payments | `PaymentProvider` (`src/lib/payments/`) | `manual` (synchronous, dev/staging only) | `stripe`, `mpesa` |
| Storage | `StorageProvider` (`src/lib/storage/`) | any S3-compatible service | — |
| Email | `EmailProvider` (`src/lib/email/`) | `console` (dev) | `resend` (real) |
| Search | `SearchService` (`src/lib/search/`) | Postgres full-text + trigram | — (OpenSearch/Elasticsearch swap point) |
| Calendar/news data | `CalendarProvider`/`NewsProvider` (`src/services/calendar/providers/`, `src/services/news/providers/`) | `manual` | `licensed-feed` |
| AI | `AIProvider` (`src/lib/ai/`) | — | `noop` (everything throws "not configured") |

Adding a real implementation for any of these means writing a new class
and adding one line to that folder's registry — never touching every call
site.

## Data flow: a purchase, end to end

1. Buyer adds a product to their `Cart`.
2. `POST /api/checkout` (with an `Idempotency-Key` header) calls
   `checkoutCart()` → creates an `Order` + `OrderItem`s → charges via
   `PaymentService` (wrapping the configured `PaymentProvider`).
3. On synchronous success (or, for an async provider, later via
   `POST /api/payments/webhook`), `completePaidOrder()` runs — inside one
   database transaction: marks the order `PAID`, issues a `License` (or
   extends a `Subscription`), posts `SALE`/`COMMISSION` `LedgerEntry` rows
   using the admin-configured commission rate, creates an `Invoice`, clears
   the cart.
4. Outside the transaction (fire-and-forget): notifications and emails to
   buyer and seller.
5. The buyer can now download the product's files
   (`/api/downloads/[productFileId]`, re-verifying entitlement every
   request) and see the invoice (`/invoices/[id]`).
6. A refund (`src/features/refunds/`) reverses steps 3-4 for the whole
   order: license/subscription revoked, invoice marked refunded, a
   `REFUND` ledger entry posted.

## Performance posture

See `docs/PHASE5_AUDIT.md` for the specific audit that shaped this, and
`docs/OBSERVABILITY.md` for monitoring. Summary of where the app stands:

- **Caching**: Redis cache-aside (`src/lib/cache.ts`) on the marketplace
  ranking query, homepage product lists, calendar's default view, the
  published news list, and public signal-provider profiles — all
  public/non-user-specific data, TTL-only invalidation (60-180s depending
  on how fast the underlying data actually changes).
- **Database**: indexes added to match every real query shape that needed
  one (not speculative); offset pagination everywhere (cursor pagination
  deferred until a specific table's scale actually needs it — see
  `docs/DATABASE.md`).
- **Background jobs**: anything slow or I/O-heavy that isn't on a user's
  critical path runs via BullMQ, not inline in a request handler — see the
  provider-adapter table above's "Calendar/news data" row and
  `docs/OBSERVABILITY.md`'s queue section.
- **Frontend**: `next/image` used everywhere except one low-traffic
  seller-tool thumbnail; no CSP yet (deferred, see `docs/SECURITY.md`); no
  formal Lighthouse/Core Web Vitals baseline has been recorded for this
  project — run one against your actual production deployment (Lighthouse
  scores are meaningfully affected by hosting/CDN choice, which this repo
  doesn't fix) before treating a number as a target to hit.

## Testing strategy

- **Unit** (Vitest) — pure logic only, no database: ranking math, commerce
  math (commission, license-activation gating), calendar date-range math,
  sync dedup gating, product quality scoring. See any `*.test.ts` file for
  the pattern.
- **End-to-end** (Playwright) — always against a real production build
  (`npm run build && npm run start`, not `next dev`) — this distinction
  has caught real bugs before (see `CLAUDE.md`'s `trustHost` note) that
  don't reproduce under dev's more permissive defaults. `e2e/global-setup.ts`
  seeds fixed-credential test accounts and fixture data idempotently.
