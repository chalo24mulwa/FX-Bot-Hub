@AGENTS.md

# FX Bot Market

A Forex EA/indicator marketplace with an integrated economic calendar. Structural
reference points: MQL5 Market (catalog model), Forex Factory Calendar (filtering),
TradingView Economic Calendar (data presentation).

## Ground rule for every phase

**Do not rebuild the application between phases. Extend the existing architecture.
Never delete or replace working features unless explicitly instructed.** Each phase
adds to this foundation rather than re-deriving it — read this file and `README.md`
before making structural changes.

## Architecture at a glance

- Next.js (App Router) + TypeScript. Layout: `src/app` (routes), `src/components`
  (`ui/` primitives, `layout/`, `marketplace/`, `admin/`, `seller/`), `src/lib`
  (cross-cutting infra), `src/server/services` + `src/features/<domain>` (business
  logic — see "Service layout" below), `src/repositories` (Prisma query modules),
  `src/config` (nav, marketplace defaults — no hard-coded filters/links in pages),
  `src/types`, `src/hooks`, `src/emails`, `src/jobs`, `tests/` (cross-cutting unit
  tests; feature-local tests stay colocated as `*.test.ts`).
- PostgreSQL via Prisma (`prisma/schema.prisma`) — pinned to **Prisma 6.19.3**, not
  the `latest` npm tag. Prisma 7 changed the config model (driver adapters required,
  no `datasource.url`); don't upgrade without deliberately migrating to that model.
- Auth.js v5 (`next-auth@beta`) in `src/lib/auth.ts`, Credentials provider + Prisma
  adapter (Google OAuth registers automatically when `AUTH_GOOGLE_ID`/`_SECRET` are
  set), JWT sessions. Route protection lives in `src/proxy.ts` (Next 16 renamed
  `middleware.ts` → `proxy.ts`; don't recreate the old file).

### RBAC / centralized authorization

Six roles (`UserRole`): `USER < SELLER == AUTHOR < MODERATOR < ADMIN < SUPER_ADMIN`
(rank order in `src/lib/authorization/roles.ts`). **Never write `role === "ADMIN"`
in a page or route** — go through `src/lib/authorization/`:
- `roles.ts` — rank + `isSeller`/`isStaff`/`isAdmin` helpers.
- `permissions.ts` — the capability matrix (`can(role, action)`); add a new
  capability here, not as an inline check at the call site.
- `guard.ts` — `requireSession()`/`requirePermission()` for route handlers &
  Server Actions, throwing `AuthorizationError`/`CsrfError`/`RateLimitError`;
  wrap handlers in `withAuthorization()` to turn those into proper responses.

Enforcement is layered: `src/proxy.ts` gates `/admin`, `/seller`, `/dashboard` at
the edge (redirects to sign-in); every admin/seller layout re-checks with `auth()`
server-side; every mutating route/action calls `requirePermission()` again. Don't
remove any one of these three layers — they're intentionally redundant.

### Provider abstractions — extend by adding a case, not by rewriting the caller

- `src/lib/payments/` — `PaymentProvider` interface. `manual-provider.ts` is the
  working default (marks orders paid instantly, for dev only). `stripe-provider.ts`
  and `mpesa-provider.ts` are typed stubs for Phase 2.
- `src/lib/storage/` — `StorageProvider` interface backed by any S3-compatible
  service (AWS S3, R2, MinIO). `getPublicUrl()` is for public assets (product
  images/screenshots) only — product **files** (EA/indicator downloads) must go
  through `getSignedDownloadUrl()` instead, since those stay private. Every upload
  path must call `validateUpload()` first (extension + MIME + size allowlist).
- `src/lib/email/` — `EmailProvider` interface. `console-provider.ts` (default)
  logs instead of sending; `resend-provider.ts` is real, gated on `RESEND_API_KEY`.
  Templates live in `src/emails/`; send via `src/jobs/send-email.ts`'s
  `enqueueEmail()` (BullMQ-backed) — always fire-and-forget (`void enqueueEmail(...)`
  or don't await it in a `Promise.all` with things that must succeed), never awaited
  on a critical path, since it must not add latency or a failure mode to the action
  that triggered it.
- `src/lib/search/` — `SearchService` interface. `PostgresSearchService` uses a
  `tsvector` column kept in sync by a DB trigger (see the `*_search_indexes`
  migration) with a trigram fallback for short queries. Swap in an
  Elasticsearch/OpenSearch implementation here later without touching callers.

### Service layout: services vs. features vs. repositories

- `src/repositories/` — thin Prisma query modules (e.g. `product-repository.ts`'s
  `buildProductWhere`/`findProducts` is the **one** reusable filter/query builder;
  every list surface — public marketplace, seller "my products", admin queue —
  composes its `where` from here instead of hand-rolling Prisma filters per page).
- `src/server/services/` — the original product/auth service layer (buyer-facing
  reads, seller CRUD). Keep using this for anything that isn't admin-only.
- `src/features/<domain>/` — domain modules added for genuinely new capability
  (`admin/product-moderation-service.ts`, `admin/user-management-service.ts`,
  `favorites/favorite-service.ts`) plus their Server Actions (`actions.ts`, used
  directly from Client Components — Next.js gives these same-origin CSRF
  protection for free, unlike hand-written `/api` routes).
- Every moderation/role-change action calls `recordAuditLog()`
  (`src/repositories/audit-log-repository.ts`) — `AuditLog` is append-only; don't
  add update/delete paths to it.

### Security

- CSRF: Server Actions get Next.js's built-in same-origin check. Hand-written
  mutating `/api` routes must call `assertSameOrigin()`
  (`src/lib/security/csrf.ts`) themselves — it isn't automatic.
- Rate limiting: `checkRateLimit()` (`src/lib/security/rate-limit.ts`) is a
  Redis fixed-window counter that **fails open** (allows the request, logs a
  warning) if Redis is unreachable — rate limiting is defense-in-depth and must
  never take down registration/login with it. `RATE_LIMIT_DISABLED=true` is a
  manual override for tests/CI; don't set it in production.
- Security headers (`X-Frame-Options`, etc.) are set in `next.config.ts`. No CSP
  yet — enabling one safely needs an inline-script audit first; don't ship a CSP
  that's either broken or too permissive just to check a box.
- `redis.ts` sets `commandTimeout` + a capped `retryStrategy` + an `error`
  listener so a down Redis fails fast and quietly instead of hanging requests or
  spamming "Unhandled error event" stack traces — keep that when touching it.

### Other

- `src/lib/cache.ts`'s `cacheWrap()` is cache-aside over Redis, used for
  slow-changing reads (homepage categories). Same fail-soft posture as rate
  limiting: a cache-read failure falls through to computing directly.
- Economic calendar (`economic_events` table, `/calendar`, `/api/calendar`) is
  seeded manually for now. `calendarSyncQueue` (`src/lib/queue/queues.ts`) exists
  for wiring a real provider later.
- SEO: `src/app/sitemap.ts` + `robots.ts` (Next.js file conventions),
  per-product `generateMetadata` + JSON-LD (`schema.org/Product`) in
  `marketplace/[slug]/page.tsx`.

## Commands

- `npm run dev` / `npm run build` / `npm run test` (Vitest) / `npm run test:e2e`
  (Playwright) / `npm run typecheck` / `npm run lint`
- `npm run db:migrate` (dev migration), `npm run db:seed`, `npm run db:studio`
- `docker compose up` starts Postgres, Redis, and MinIO for local dev — copy
  `.env.example` to `.env` first.

## Known follow-ups (intentionally deferred, not oversights)

- Checkout has no real payment UI yet — `PAYMENT_PROVIDER=manual` marks orders paid
  synchronously so the buy flow is testable before Stripe/M-Pesa are implemented.
- License-key issuance on purchase, vendor payouts, product file upload UI
  (seller side), and subscription billing lifecycle are schema-ready
  (`License`, `ProductFile`, `Subscription`) but not built yet.
- `ProductRatingSummary` is a materialized aggregate, deliberately not recomputed
  automatically yet — there's no review-submission endpoint in this phase, so
  nothing writes `Review`/`ProductRating` rows to aggregate from. Wire the
  recompute into that endpoint when it's built, not before.
- News/Analysis/Community/Guides/Tutorials/Developer-Resources are stub
  ("coming soon") pages so nav links aren't dead — no content model behind them.
- The `/admin`, `/seller`, `/dashboard` redirect-to-sign-in for an
  authenticated-but-unauthorized user is a UX nit (looks like "not logged in"
  when it's really "wrong role") — a dedicated 403 page would be a cheap fix.
