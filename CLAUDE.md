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
  tests; feature-local tests stay colocated as `*.test.ts`), `e2e/` (Playwright).
- PostgreSQL via Prisma (`prisma/schema.prisma`) — pinned to **Prisma 6.19.3**, not
  the `latest` npm tag. Prisma 7 changed the config model (driver adapters required,
  no `datasource.url`); don't upgrade without deliberately migrating to that model.
- Auth.js v5 (`next-auth@beta`) in `src/lib/auth.ts`, Credentials provider + Prisma
  adapter (Google OAuth registers automatically when `AUTH_GOOGLE_ID`/`_SECRET` are
  set), JWT sessions. Route protection lives in `src/proxy.ts` (Next 16 renamed
  `middleware.ts` → `proxy.ts`; don't recreate the old file).
  **`trustHost: true` is required** — Auth.js only auto-trusts localhost in `next
  dev`; a production build (`next start`, Docker, CI) rejects every sign-in as
  "UntrustedHost" without it. This is exactly the kind of bug that only shows up
  once you test against a production build — see "Testing" below.

### RBAC / centralized authorization

Six roles (`UserRole`): `USER < SELLER == AUTHOR < MODERATOR < ADMIN < SUPER_ADMIN`
(rank order in `src/lib/authorization/roles.ts`). **Never write `role === "ADMIN"`
in a page or route** — go through `src/lib/authorization/`:

**Role/ban changes and session staleness**: a JWT session carries whatever role
was true at sign-in — `src/lib/auth.ts`'s `jwt()` callback resyncs it from the
DB periodically (`ROLE_REFRESH_INTERVAL_MS`, 60s) so admin role changes and bans
take effect without forcing a re-login, and ends the session outright if the
user is now banned. If you write code that changes a role/ban for the
**currently signed-in user** (self-service onboarding is the only example so
far — `becomeSellerAction` in `src/features/users/actions.ts`) and then redirect
to somewhere gated by the new role, call `updateSession({})` (exported from
`src/lib/auth.ts`) first — otherwise the redirect races the stale JWT and
bounces the user straight back to sign-in. This one only reproduces with a real
browser session; a direct DB check in a test won't catch it.
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
  working default (marks orders paid instantly, for dev only, and is what
  `checkoutCart()` calls). `stripe-provider.ts` and `mpesa-provider.ts` are typed
  stubs — wiring one in is the natural next phase.
- `src/lib/storage/` — `StorageProvider` interface backed by any S3-compatible
  service (AWS S3, R2, MinIO). `getPublicUrl()` (in `public-url.ts`) is for public
  assets (product images/screenshots) only, and is called from **Client
  Components** (product cards, the asset manager) — it deliberately does NOT
  import `@/lib/env` (which parses every server secret and crashes if bundled for
  the browser); it reads `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` directly instead.
  If you need another public-safe value from storage config, add a new
  `NEXT_PUBLIC_` var rather than piping it through `env.ts`. Product **files**
  (EA/indicator downloads) must go through `getSignedDownloadUrl()` instead, since
  those stay private — see "Entitlement / downloads" below. Every upload path
  must call `validateUpload()` first (extension + MIME + size allowlist).
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

### Entitlement / secure downloads

`src/features/downloads/entitlement-service.ts`'s `checkEntitlement()` is the
**only** place that decides "can this user download this product's files" —
every download path goes through it. It is deliberately strict: a product being
`pricingType: FREE` does **not** by itself grant entitlement. A `License` row
must exist (owner and staff are entitled unconditionally; everyone else needs
one), and that row is only created by `ensureLicense()` from
`completePaidOrder()` — including for $0 orders, since a FREE product still goes
through `checkoutCart()` (`ManualPaymentProvider` settles it instantly). This
keeps "owns it" consistently meaning "has an Order/License record," so Orders
history and download entitlement never disagree with each other. Don't add a
`pricingType === "FREE" → entitled` shortcut back in; it was tried and reverted
because it silently bypassed Orders/License entirely.

`src/app/api/downloads/[productFileId]/route.ts` re-checks entitlement on every
request (never trust a previously-rendered "you own this" state), logs a
`Download` row, then redirects to a short-lived (`getSignedDownloadUrl`, 120s)
URL — it never returns a raw storage URL.

`src/app/api/licenses/verify/route.ts` is an explicit **stub** for a future
MT4/MT5-side license check. Read its doc comment before telling a seller their
EA is "protected" — nothing today enforces this inside an actual `.ex4`/`.ex5`.

### Commerce: cart → checkout → license

`Cart`/`CartItem` (`src/features/cart/cart-service.ts`) → `checkoutCart()`
(`src/features/checkout/checkout-service.ts`) creates an `Order` + `OrderItem`s,
calls the configured `PaymentProvider`, and — if the charge settles synchronously
(true today) — marks the order `PAID` and calls `completePaidOrder()`
(idempotent) to issue licenses, clear the bought items from the cart, and notify
buyer + seller(s). An async provider (Stripe/M-Pesa, once implemented) instead
leaves the order `PENDING`; a webhook handler would call `completePaidOrder()`
later — that handler doesn't exist yet, only the idempotent function it would call.

### Moderation workflow

`ProductStatus`: `DRAFT → PENDING_REVIEW → UNDER_REVIEW → PUBLISHED`, with
`REJECTED`/`SUSPENDED`/`ARCHIVED` alongside. `UNDER_REVIEW` is reached via
`claimForReview()` (assigns `assignedModeratorId`) — PENDING_REVIEW is "waiting
for anyone," UNDER_REVIEW is "someone's on it." `PUBLISHED` is this app's
"approved and live" state — Phase 2's own spec calls it APPROVED, but renaming
would touch every status check for no behavioral gain; the schema comment on
`ProductStatus` documents the mapping instead. Rejection reasons are stored on
`Product.rejectionReason` (shown to the seller) — full history of every
approve/reject/suspend/claim is in `AuditLog` (`entityType: "Product"`), not a
separate moderation-history table.

### Ranking (discovery: Popular / Best Sellers)

`src/lib/ranking/ranking-service.ts` computes a weighted score (sales,
downloads, reviews, rating, recency, favorites — **not** price) over a bounded
candidate set (`CANDIDATE_LIMIT = 500` published products matching the other
filters), fetched in one query with relation counts, then sorted in memory. The
weights are admin-configurable (`MarketplaceSettings.rankingWeights`, edited at
`/admin/settings`, read via `src/features/admin/settings-service.ts`). The pure
scoring math is factored into `src/lib/ranking/score.ts` (`computeRankingScore`)
specifically so it's unit-testable without a database — extend the weight set
there, not by inlining new math into `ranking-service.ts`.

### Service layout: services vs. features vs. repositories

- `src/repositories/` — thin Prisma query modules (e.g. `product-repository.ts`'s
  `buildProductWhere`/`findProducts` is the **one** reusable filter/query builder;
  every list surface — public marketplace, seller "my products", admin queue —
  composes its `where` from here instead of hand-rolling Prisma filters per page).
- `src/server/services/` — the original product/auth service layer (buyer-facing
  reads, seller CRUD, view-count increment). Keep using this for anything that
  isn't admin-only.
- `src/features/<domain>/` — domain modules for specific capability: `admin/`
  (moderation, user management, marketplace settings), `seller/` (asset uploads,
  analytics aggregation, Server Actions), `cart/`, `checkout/`, `downloads/`
  (entitlement), `reviews/`, `favorites/` (including price/version-change
  notifications to favoriters). Each domain's `actions.ts` (where present) holds
  its Server Actions, used directly from Client Components — Next.js gives these
  same-origin CSRF protection for free, unlike hand-written `/api` routes.
- Every moderation/role-change/settings action calls `recordAuditLog()`
  (`src/repositories/audit-log-repository.ts`) — `AuditLog` is append-only; don't
  add update/delete paths to it.

### Security

- CSRF: Server Actions get Next.js's built-in same-origin check. Hand-written
  mutating `/api` routes must call `assertSameOrigin()`
  (`src/lib/security/csrf.ts`) themselves — it isn't automatic.
- Rate limiting: `checkRateLimit()` (`src/lib/security/rate-limit.ts`) is a
  Redis fixed-window counter that **fails open** (allows the request, logs a
  warning) if Redis is unreachable — rate limiting is defense-in-depth and must
  never take down registration/login/checkout with it. `RATE_LIMIT_DISABLED=true`
  is a manual override for tests/CI; don't set it in production.
- Security headers (`X-Frame-Options`, etc.) are set in `next.config.ts`. No CSP
  yet — enabling one safely needs an inline-script audit first; don't ship a CSP
  that's either broken or too permissive just to check a box.
- `redis.ts` sets `commandTimeout` + a capped `retryStrategy` + an `error`
  listener so a down Redis fails fast and quietly instead of hanging requests or
  spamming "Unhandled error event" stack traces — keep that when touching it.
- File uploads never touch the server's memory/disk: sellers get a presigned PUT
  URL (`/api/seller/uploads/presign`, validated by `validateUpload()`) and upload
  directly to object storage, then call `/api/seller/products/[id]/assets` to
  record the resulting `storageKey` in the DB. See `src/features/seller/
  upload-client.ts` for the browser-side flow (including client-computed
  SHA-256 checksums for product files).

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

## Testing

- `npm run test` (Vitest) — pure-logic unit tests only (authorization matrix,
  upload validation, ranking score math). Nothing here touches Postgres/Redis.
- `npm run test:e2e` (Playwright) — **always validates against a production
  build** (`playwright.config.ts`'s `webServer` runs `npm run build && npm run
  start`), not `next dev`. This matters: the `trustHost` bug above only
  reproduced under a production build, because `next dev` trusts localhost
  automatically and masked it completely. If you're debugging an e2e failure
  that doesn't reproduce in `npm run dev`, that gap is often the reason —
  don't assume it's test flakiness.
- `e2e/global-setup.ts` seeds three fixed-credential accounts
  (`e2e-buyer@`, `e2e-seller@`, `e2e-admin@fxbotmarket.local`, password
  `password123`) plus one published free product, idempotently, against
  whatever `DATABASE_URL` the run points at (CI's ephemeral Postgres included).
  It does not depend on `prisma/seed.ts` — don't make e2e specs depend on that
  seed's data either; add to `global-setup.ts` instead.
- File-upload steps are skipped in `product-lifecycle.spec.ts` — CI has no
  MinIO/S3 service, so presigned uploads have nowhere to land. The wizard's
  Next button on those steps is exercised (so a broken upload step's UI would
  still be caught), just not an actual file transfer.

## Commands

- `npm run dev` / `npm run build` / `npm run test` (Vitest) / `npm run test:e2e`
  (Playwright) / `npm run typecheck` / `npm run lint`
- `npm run db:migrate` (dev migration), `npm run db:seed`, `npm run db:studio`
- `docker compose up` starts Postgres, Redis, and MinIO for local dev — copy
  `.env.example` to `.env` first.

## Known follow-ups (intentionally deferred, not oversights)

- No real payment provider wired up — `PAYMENT_PROVIDER=manual` marks orders
  paid synchronously so the full cart→checkout→license flow is testable before
  Stripe/M-Pesa are implemented against the existing `PaymentProvider` interface.
  There's correspondingly no payment webhook handler yet (see "Commerce" above).
- `/api/licenses/verify` is a stub, not a working MT4/MT5-side DRM mechanism —
  see its doc comment. Don't tell a seller their EA is "protected" from copying.
- Vendor payout processing (Stripe Connect / M-Pesa B2C) is not built — the
  seller payout settings page only records where payouts *should* go.
- Product review by the product's own seller isn't blocked — a low-priority
  edge case, not a security issue (their review still needs their own purchase
  to be "verified," which they get for free as the owner, so it'd read oddly
  but isn't exploitable for anything).
- News/Analysis/Community/Guides/Tutorials/Developer-Resources are stub
  ("coming soon") pages so nav links aren't dead — no content model behind them.
- The `/admin`, `/seller`, `/dashboard` redirect-to-sign-in for an
  authenticated-but-unauthorized user is a UX nit (looks like "not logged in"
  when it's really "wrong role") — a dedicated 403 page would be a cheap fix.
- "Developer announcements" (a seller broadcasting an update to favoriters
  beyond the automatic price-change/new-version notifications) isn't built.
