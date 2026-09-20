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
charges through `PaymentService` (`src/lib/payments/payment-service.ts`, wrapping
the configured `PaymentProvider`), and — if the charge settles synchronously
(true today) — marks the order `PAID` and calls `completePaidOrder()`
(idempotent) to issue licenses/subscriptions, record the commission split +
ledger entries + invoice, clear the bought items from the cart, and notify
buyer + seller(s). An async provider (Stripe/M-Pesa, once implemented) instead
leaves the order `PENDING`; `POST /api/payments/webhook` calls
`completePaidOrder()` later once the provider confirms the charge — see
"Phase 4" below for the full payment/refund/subscription architecture.

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
- SEO: `src/app/sitemap.ts` + `robots.ts` (Next.js file conventions),
  per-product `generateMetadata` + JSON-LD (`schema.org/Product`) in
  `marketplace/[slug]/page.tsx`. Phase 3 extended the sitemap with published
  news articles, signal provider profiles, and per-currency calendar pages.

## Phase 3: calendar, news, signals, alerts

Adds Forex Signals, an overhauled Economic Calendar, Forex News, and a
polymorphic alert/subscription system on top of Phases 1-2's marketplace.
Nothing here replaces the payment, auth, or RBAC foundations — signal
subscriptions bill through the *same* `paymentProvider` singleton
(`src/lib/payments`) as marketplace checkout, not a second integration.

### Calendar/news provider abstraction

`src/services/calendar/providers/` and `src/services/news/providers/` mirror
the payments/storage/email pattern: a `key`-based registry
(`getCalendarProvider(key)` / `getNewsProvider(key)`), a working `manual`
provider (reads/writes this app's own rows, `source: "manual"`), and a typed
`licensed-feed` stub that throws "not configured" until a real licensed
feed is wired in. **Do not scrape Forex Factory/TradingView/MQL5** — new
providers must be built against a real API or licensed feed; see the schema
comment on `DataSource`.

- `EconomicCalendarService` (`src/services/calendar/calendar-service.ts`)
  is the **only** read path for calendar data — always paginated
  (`MAX_PAGE_SIZE = 250`), always date-bounded (`from`/`to` required). Never
  add a query that scans the whole `economic_events` table; a calendar
  accumulates years of history. `buildEventWhere()` is factored out as a
  pure function specifically so filter-combination logic (empty array vs.
  undefined vs. populated) is unit-testable without a DB — see
  `calendar-service.test.ts`.
- `runCalendarSync()` / `runNewsSync()` (`*/sync-service.ts`) loop every
  *enabled* `DataSource` of the matching kind, upsert by `externalId`
  (dedup — a re-run never creates duplicates, only refreshes
  actual/forecast/previous), and record one `SyncLog` row per run. One
  provider failing doesn't abort the others. The HIGH-impact-alert gate is
  factored into a pure `shouldDispatchHighImpactAlert(wasExisting, impact)`
  predicate for the same unit-testability reason — see
  `sync-service.test.ts`.
- `runMarketDataSync()` (`src/services/market-data/sync-service.ts`) is an
  **honest, fully-wired stub** — real queue, real `SyncLog` entries, real
  `DataSource` loop, zero actual data written. No `MarketPrice`/instrument
  schema was invented for it since Phase 3's brief didn't specify one;
  read the file's doc comment before building against it.
- Sync jobs run via BullMQ (`calendarSyncQueue`/`newsSyncQueue`/
  `marketDataSyncQueue` in `src/lib/queue/queues.ts`, `SYNC_JOB_OPTIONS`:
  3 attempts, exponential backoff from 30s) — start workers with
  `npm run worker:calendar-sync` / `worker:news-sync` /
  `worker:market-data-sync`, or enqueue one-off runs with
  `npm run sync:trigger` (`scripts/trigger-sync.ts`), e.g. from an external
  cron. There is no in-process scheduler; something outside the app must
  call one of these.

### Calendar display: UTC only, not viewer-local

`CalendarTable` (`src/components/calendar/calendar-table.tsx`) renders
event times in UTC with an explicit "(UTC)" column header, not the
viewer's local timezone — deliberately, to avoid an SSR/client hydration
mismatch from formatting a `Date` with the visitor's timezone on the
server. The underlying range math
(`src/lib/calendar/date-ranges.ts` — `getPresetRange`/`getCustomRange`) is
already timezone-aware (takes a viewer UTC offset in minutes) and
unit-tested; only the *display* of individual event timestamps is
UTC-only. Per-viewer display localization is a known follow-up.

### Alerts: polymorphic model, required targetId

`Alert` (`src/features/alerts/`) is one table for five alert types
(`ECONOMIC_EVENT`/`CURRENCY`/`SIGNAL_PROVIDER`/`PRODUCT`/`NEWS_TOPIC`),
keyed by `targetId: String` (no FK — deliberately, to avoid cascade-delete
surprises across five different target tables) with a
`@@unique([userId, type, targetId])` constraint. **`targetId` must stay a
required `String`, never optional** — a compound-unique `where` clause
with a nullable field doesn't type-check cleanly against Prisma's
`upsert`/`findUnique` (Postgres NULLs aren't equal, so the generated type
can't accept `null` there), and worse, a nullable targetId would make
"alert on X" and "no target set" indistinguishable. If a future alert type
doesn't have a natural target id, mint a synthetic one — don't relax this
field back to optional.

`dispatch-service.ts` fans an event out to every subscriber via the
existing `notification-repository.ts` + `send-email.ts` (fire-and-forget,
same pattern as the rest of the app) and schedules a delayed BullMQ job
(`eventReminderQueue`, fires 30 minutes before `eventTime`) for economic
event reminders. Alerts only fire for genuinely new state (a new HIGH
event, a newly published signal) — see the sync dedup note above; nothing
re-alerts existing subscribers on every sync pass.

### Signal providers: verified vs. self-reported, never fabricated

`computeProviderStats()` (`src/features/signals/provider-service.ts`)
always computes from this app's own `Signal` rows — i.e. inherently
self-reported by the provider's own publish/close actions.
`SignalProviderProfile.verified` is a **separate, admin-only** boolean
(`setProviderVerifiedAction`, `signal:moderate` permission) that the UI
must check independently before showing a "verified" badge. Win rate
(`winRatePercent`) is `null` — never a fabricated `0%` or `NaN` — when
there are zero closed signals; don't add a default that turns "no data"
into a number.

### Signal subscriptions

`SignalSubscription` reuses the existing `SubscriptionStatus` enum
(`ACTIVE`/`CANCELED`/`EXPIRED`/`PAST_DUE`, extended with `PAUSED`) rather
than a near-duplicate enum, despite Phase 3's brief spelling it
"CANCELLED" — a deliberate reuse decision, not an oversight.
`subscribeToProvider()` activates a `FREE` provider's subscription
instantly with no charge; a paid (`SUBSCRIPTION`) provider goes through
`paymentProvider.createCharge()` exactly like marketplace checkout,
including the same "async provider leaves it pending, a webhook would
complete it later" shape — see "Commerce" above.

### Client/Server Component boundary bug pattern

`SignalCard` (`src/components/signals/signal-card.tsx`) originally needed
`"use client"` because it attached an inline `onClick`
(`stopPropagation()`) to a nested `<Link>`. Without it, the component
type-checks and builds fine, and even renders fine on every page where the
list happens to be empty — the crash ("Event handlers cannot be passed to
Client Component props") only appeared once a Server Component actually
rendered it with real data. General trap worth remembering: an event
handler passed as a prop from a Server Component context fails at
*request* time, not build time, and can hide behind an empty-state branch
in manual/spot-checked testing. E2E tests must exercise the
populated-list path, not just the "no results yet" empty state, for
exactly this reason.

That nested `<Link>` turned out to be its own separate bug, found and
fixed in Phase 5 — see "Phase 5" below. `SignalCard` no longer needs
`"use client"` at all: the stretched-link pattern it uses now has no
client-side interactivity of its own.

## Phase 4: commercial infrastructure

Adds real payment/refund/license/payout plumbing on top of Phases 1-3's
checkout, without touching the marketplace, calendar, news, or signals
domains. The core principle running through all of it, per Phase 4's own
brief: **a frontend "success" page is never itself proof a payment
happened.** The only trusted confirmations are a DB-recorded `Payment`
row (`SUCCEEDED`) and a verified webhook — see `PaymentService` below.

### PaymentService: the one place that talks to a PaymentProvider

`src/lib/payments/payment-service.ts` wraps the adapter interface
(`PaymentProvider` in `src/lib/payments/types.ts` — `createCharge`/
`parseWebhook`/`refundCharge`) with the operations Phase 4 asked for:
- `createPayment()` — records a `Payment` row and charges it in one step;
  checkout and subscription renewal both go through this, never
  `paymentProvider.createCharge()` directly.
- `getPaymentStatus()` / `verifyPayment()` — the trusted DB-recorded
  status. For the synchronous `manual` provider this is just a read; a
  real async provider would reconcile against the processor here.
- `handleWebhook()` — verifies the payload (provider's job — see the doc
  comments on `stripe-provider.ts`/`mpesa-provider.ts` for what a real
  implementation must check), dedupes by the provider's own event id
  (`ProcessedWebhookEvent`, distinct from `Payment.providerReference` —
  one charge can generate multiple webhook deliveries), and updates the
  matching `Payment`. `POST /api/payments/webhook` is the one route every
  provider posts to; it calls `completePaidOrder()`/`markOrderFailed()`
  based on the result and logs a `SecurityEvent` on a signature failure.
- `refundPayment()` — the provider-facing half of a refund only (calls
  `provider.refundCharge()`). The actual refund *workflow*
  (REQUESTED/APPROVED/REJECTED/PROCESSED, reversing licenses/
  subscriptions/invoices/ledger entries) lives one layer up in
  `src/features/refunds/refund-service.ts`, which calls this as one step
  — kept separate so "charge a refund through the provider" and "what a
  refund means for this app's own records" don't mix.

The illustrative directory Phase 4's brief names
(`/services/payments/providers/`) isn't literally where this lives —
`src/lib/payments/` already existed from Phase 2 as the adapter registry
(`manual`/`stripe`/`mpesa`, `paymentProvider` singleton) and this extends
it rather than relocating it, same reasoning as Phase 2's PUBLISHED/
APPROVED naming call.

### Idempotency: client-supplied key, DB-enforced

`Order.idempotencyKey` (unique, optional) is how a retried checkout
submission — a double-click, a flaky network retry — returns the
*existing* order instead of creating a duplicate one.
`CheckoutButton` generates one `crypto.randomUUID()` per mount (stable
across retries of that same click) and sends it as an `Idempotency-Key`
header; `checkoutCart()` checks for an existing order with that key
before doing anything else. **Two genuinely concurrent requests with the
same key** (not just a sequential retry) both pass that check before
either commits — the real guard is the DB's own unique constraint:
`checkoutCart()` catches the `P2002` violation on `Order.create()` and
returns the winner's order instead of erroring. Don't remove that
catch — an e2e test (`checkout.spec.ts`'s idempotency test, which fires
two requests via `Promise.all`) exists specifically to catch a regression
here, and it only reproduces under real concurrency, not a sequential
retry.

### Entitlement: License for one-time/free, Subscription for recurring

`checkEntitlement()` (`src/features/downloads/entitlement-service.ts`)
branches on `Product.pricingType`: `SUBSCRIPTION` products are entitled by
an `ACTIVE`/`TRIAL` `Subscription` row, everything else by a `License` row
(`isLicenseUsable()` in `src/lib/commerce/license.ts` — status `ACTIVE`
and not expired). `completePaidOrder()` creates the right one per item;
no product ever gets both. `Download.success` records denied attempts
too (not just successful downloads), so the admin/security surfaces can
see failed access attempts, not only completed ones.

### License activation: real slots, not just a counter

`LicenseActivation` (one row per machine/terminal fingerprint) backs
`maxActivations` with actual rows instead of a counter that can drift —
`activateLicense()`/`deactivateLicense()`/`verifyLicenseKey()`
(`src/features/licenses/license-service.ts`) are what
`POST /api/licenses/{verify,activate,deactivate}` call. These are the
only unauthenticated-by-session endpoints in the commerce surface — an
EA has no browser session, so the license key itself is the credential
(exactly how commercial EA licensing works elsewhere), protected by rate
limiting rather than `assertSameOrigin()`. **Don't add a same-origin
check to these three routes** — a same-site browser session is not the
expected caller. `SUSPENDED` (reversible hold) vs `REVOKED` (permanent)
are both admin-only (`license:manage`, `/admin/licenses`); a buyer's own
keys are visible at `/dashboard/licenses`.

### Seller commissions and the payout ledger

`computeCommission()` (`src/lib/commerce/commission.ts`, pure/unit-tested)
splits a sale using the existing, previously-unused
`MarketplaceSettings.commissionPercent` — Phase 4 is what actually wires
that admin-configurable field into a real financial effect for the first
time. Every `completePaidOrder()` item writes two `LedgerEntry` rows
(`SALE` +gross, `COMMISSION` -commission) plus one `Invoice`. **A
seller's balance is always `SUM(LedgerEntry.amountCents)`
(`getSellerBalance()`), never a stored/updated counter** — see the
`LedgerEntry` model comment in `schema.prisma`. `Payout` records a
seller's payout *request* only; no processor (Stripe Connect/M-Pesa B2C)
is wired up, same gap as `SellerProfile.payoutEmail` since Phase 2 — an
admin marks a payout `PAID` once money has actually moved through
whatever channel is in use, which writes the offsetting `PAYOUT` ledger
entry.

### Refunds: whole-order only, by design

A refund targets a whole `Order`'s `Payment` (real processors refund a
charge, and `Payment` is per-`Order`, not per-item) —
`src/features/refunds/refund-service.ts`'s `requestRefund()` /
`rejectRefund()` / `approveAndProcessRefund()` reverse *every* item in
the order: `License` → `REVOKED`, `Subscription` → `CANCELED`, each
`Invoice` → `REFUNDED`, one `REFUND` ledger entry per seller. Partial
(single-item) refunds of a multi-item order aren't supported — a
deliberate scope limit (allocating a partial refund's commission
correctly across items needs a design of its own), not an oversight.
`APPROVED` is not a separately-persisted intermediate state for the
`manual` provider — approving and processing happen in one call, since
there's no async "capture" step to wait on; a real async processor would
still resolve inline here (the provider call is awaited before the
function returns).

### Product subscription renewal: same pattern as Phase 3's sync jobs

`src/services/subscriptions/renewal-service.ts`'s
`runSubscriptionRenewals()` follows the exact "no in-process scheduler,
an external cron calls a trigger script" model Phase 3 established for
calendar/news sync (see below) — `npm run worker:subscription-renewal`
runs the worker, `npm run subscriptions:renew`
(`scripts/trigger-subscription-renewal.ts`) enqueues one run. A renewal
creates a normal `Order`/`Payment` (idempotency-keyed as
`renewal:<subscriptionId>:<currentPeriodEnd>` so a job re-run can't
double-charge the same period) and calls the *same* `completePaidOrder()`
checkout uses — a renewal and an initial purchase produce identical
ledger/invoice/notification effects, deliberately, rather than a parallel
"billing" code path. A failed renewal charge sets the subscription
`PAST_DUE`, not `CANCELED` — nothing here auto-cancels on one failed
charge.

### Invoices: printable HTML, not a generated PDF file

`/invoices/[id]` is a plain server-rendered page with a "Print / Save as
PDF" button (`window.print()`) rather than a PDF-generation library —
there wasn't one in this project already, and the browser's own
print-to-PDF produces a real downloadable PDF with zero new dependencies.
One `Invoice` per `OrderItem` (not per `Order`) — see the model comment
in `schema.prisma` for why (a cart can mix products from different
sellers; an invoice's "Seller"/"Product" fields are singular).

### Fraud/security: log, never auto-act

`SecurityEvent` (`/admin/security`) is written by
`checkRepeatedPaymentFailures()`/`checkSuspiciousDownloadPattern()`
(`src/lib/security/fraud.ts`, called after a failed payment / a
successful download) and by an invalid webhook signature
(`WEBHOOK_SIGNATURE_INVALID`, in the webhook route) or a
license-activation-limit hit (`MULTIPLE_FAILED_LICENSE_ACTIVATIONS`, in
`license-service.ts`). **Nothing reads a `SecurityEvent` and
automatically bans, suspends, or revokes anything** — per Phase 4's own
instruction ("Do not automatically ban users based solely on simplistic
rules"), these are signals for an admin to act on, not triggers. Don't
wire one up to an automatic action without that being an explicit,
separate decision.

## Phase 5: scale, security, and observability

A real audit before any change (`docs/PHASE5_AUDIT.md` — four parallel
research passes over the actual codebase, not guessed), then targeted
fixes. Full documentation set added under `docs/` — see `README.md`'s
"Documentation" section for the index; this section is the short summary
of what changed and why, cross-referencing those docs rather than
repeating them.

- **Checkout atomicity fix**: `completePaidOrder()` previously ran its
  per-order-item writes (license/subscription, ledger, invoice) as
  separate sequential awaited calls with no transaction — a real
  correctness gap (a crash mid-loop could leave an order `PAID` with only
  some items licensed), not just a performance one. Now wrapped in one
  `$transaction`, with ledger entries and invoices batched via
  `createMany` across all items instead of inserted one at a time.
- **`cacheWrap()`'s own lookup could silently cost ~2s** — the single most
  important bug this phase's regression pass found, because it undermined
  the entire caching rollout, not just one page. `redis.get()` inside
  `cacheWrap()` shares `src/lib/redis.ts`'s single ioredis client, whose
  `commandTimeout` (2000ms) is tuned for BullMQ — reasonable for a queue
  command, wildly too slow for what's supposed to be a cheap cache check.
  When Redis is unreachable, a queued `GET` doesn't reject until that
  timeout elapses, so *every* `cacheWrap()` call added up to ~2s, and a
  page calling it twice (e.g. the signal provider profile page's provider
  lookup + stats lookup) added up to ~4s — slower than not caching at
  all. This was initially misdiagnosed as a UI bug (see the `SignalCard`
  entry below) because the symptom looked identical: a client-side
  navigation whose destination page renders too slowly for its URL to
  have updated within a 5s test assertion looks exactly like "the click
  didn't do anything." Fixed with an independent, short (250ms)
  `Promise.race` timeout around every Redis read *and* write in
  `cacheWrap()`/`cacheInvalidate()` — a cache lookup now can never
  meaningfully stall a request, regardless of the shared client's own
  timeout. **Lesson**: a slow fallback is not a safe fallback — "fails
  open" needs to also mean "fails open *fast*," especially for something
  whose whole purpose is to make a request faster, not slower.
- **`SignalCard`'s nested-`<Link>`**: a *real*, separate bug found in the
  same investigation, initially (and incorrectly) blamed for the above
  symptom. `signal-card.tsx` nested a `<Link>` (the provider name, with
  `stopPropagation`) inside another `<Link>` (the whole-card link) —
  nested `<a>` tags are invalid HTML, and browsers silently restructure
  the DOM to cope with it. Worth fixing regardless of whether it was the
  actual cause of the failing test (it wasn't — the cache timeout above
  was). Two fix attempts before the right one: a `<div onClick={...}
  role="link">` wrapper still didn't resolve the (actually unrelated)
  test failure and separately reintroduced ambiguity of its own —
  stamping `role="link"` on the div puts a *second* "link" into the
  accessibility tree with an aggregated accessible name, the same kind of
  nested-interactive-element ambiguity the fix was meant to remove, just
  via ARIA instead of HTML. The actual fix: the standard "stretched link"
  CSS pattern — an absolutely-positioned `<Link>` covering the whole card
  as the click target, with the provider-name `<Link>` as a normal
  sibling at a higher `z-index` so its own click area wins. Two real
  anchors, siblings, no nesting, no synthetic ARIA role standing in for a
  second one — see `FavoriteButton`'s sibling-not-nested positioning in
  `product-card.tsx` for the same underlying principle applied slightly
  differently. `SignalCard` no longer needs `"use client"` at all as a
  result. **Lesson, twice over**: (1) a plausible-looking root cause that
  "should" explain a symptom isn't confirmed until the fix for it actually
  makes the test pass — this one didn't, for two attempts in a row, which
  was the signal to keep looking rather than declare victory; (2) when a
  fix doesn't resolve the failure it was aimed at, don't just try a
  different fix for the same theory — go find the *actual* cause.
- **`checkRateLimit()` had the same "slow fallback" bug as `cacheWrap()`,
  found later** (while reloading the local dev host during the
  market-data-chart work — every request through it, not just the new
  routes, was taking ~2.3-2.8s to respond with Redis down locally): it
  awaited `redis.incr()`/`redis.expire()`/`redis.ttl()` directly, relying
  only on the shared client's 2000ms `commandTimeout`, which doesn't even
  start counting until a command is dispatched over a live connection —
  when Redis is unreachable outright (not just slow), ioredis's own
  connect/retry overhead runs first. Fixed by extracting `cacheWrap()`'s
  short-timeout race into a shared `withRedisTimeout()` helper
  (`src/lib/redis.ts`, default 250ms) and using it in both `cache.ts` and
  `rate-limit.ts` — cut a Redis-down request from ~2.3-2.8s to ~500-590ms
  (two sequential 250ms-budgeted calls — `checkRateLimit`'s own
  incr/expire plus the route's separate `cacheWrap` lookup — stacking
  rather than 2000ms+ per call). **Lesson**: this exact bug class
  (fail-open relying on a timeout tuned for a different caller) isn't a
  one-time fix scoped to wherever it was first found — check every other
  caller of the same shared client for the same assumption once you find
  it once.
- **Sign-in rate-limit correctness**: the first version of the Phase 5
  sign-in rate-limit fix checked the limit *before* verifying the
  password, so every successful sign-in also counted against it — this
  broke this app's own e2e suite (fixed-credential accounts shared and
  signed into repeatedly across parallel spec files). Corrected to only
  record *failed* attempts. Running the full suite again then surfaced
  the same "shared client, 2s commandTimeout" problem as the cache bug
  above, independently: `auth.spec.ts`'s "wrong password is rejected"
  test timed out because two rate-limit checks were awaited
  *sequentially*, doubling the fail-open cost to ~4s on every failed
  sign-in. Fixed by running both checks in `Promise.all` (rate limiting's
  fail-open cost is bounded by the shared client's own timeout, unlike
  the cache fix above — a rate-limit check happening once per request,
  not compounding across multiple calls on one page, made parallelizing
  sufficient here without needing its own shorter timeout too). Two real,
  test-suite-caught regressions from one seemingly-obvious fix — see
  `docs/DEVELOPER_GUIDE.md`'s review checklist for why running the tests
  matters even when a change looks correct on inspection.
- **`/admin/queues` could hang indefinitely**: BullMQ's own Redis
  connection handling doesn't reliably bound command latency when Redis
  was *never* reachable at all (distinct from "was reachable, then
  dropped," which `src/lib/redis.ts`'s `commandTimeout` is tuned for) —
  this page hung past Playwright's 30s test timeout under that condition.
  Fixed with an explicit `Promise.race`-based timeout guard per queue,
  degrading to a visible "unavailable" row instead of hanging the whole
  page. A monitoring page must never become unusable because the thing
  it's monitoring is down.
- **Idempotency-key race**: `checkout.spec.ts` gained a test that fires
  two concurrent checkout requests with the same `Idempotency-Key` via
  `Promise.all` — this reproduces a genuine race the sequential-retry case
  doesn't (both requests can pass the "does this key exist" check before
  either commits). Fixed by catching the resulting DB unique-constraint
  violation in `checkoutCart()` and returning the winner's order. Keep
  this test — it's the only thing that would catch a regression here.
- **Caching, and its Date-serialization gotcha**: `cacheWrap()`
  (`src/lib/cache.ts`) round-trips through JSON, so a `Date` field is a
  real `Date` object on a cache miss but a **string** on a cache hit.
  Before Phase 5, exactly one thing was cached (the homepage's category
  list, which happens to have no `Date` fields — not a coincidence).
  Phase 5 added caching to the marketplace ranking query, homepage
  product lists, calendar's default view, published news, and signal
  provider profiles — each checked against its actual downstream
  consumers first; calendar and news needed an explicit Date-revival step
  (`reviveEventDates()`/`reviveArticleDates()`) because `CalendarTable`
  and the news list call `.toISOString()`/`.toLocaleDateString()` directly
  with no `Date | string` tolerance, unlike `ProductCard` (which already
  had that tolerance, for reasons predating Phase 5 — see
  `docs/DEVELOPER_GUIDE.md`'s cache gotcha section before adding a new
  cached read).
- **Security fixes** (`docs/PHASE5_AUDIT.md` has the full list): sign-in
  rate limiting (was previously unlimited-attempt), a hard production
  refusal on `/api/payments/webhook` if `PAYMENT_PROVIDER=manual` is ever
  set in production (that provider does zero signature verification by
  design — see its own doc comment — and was never meant to reach
  production), plus rate limiting on review creation, refund requests,
  and favorite toggling (the last two because they feed the ranking score
  and the financial ledger respectively, so unlimited-rate abuse isn't
  just a performance concern).
- **Product quality checklist** (`src/lib/quality/product-quality.ts`) —
  a pure, unit-tested scoring function over concrete signals
  (documentation/screenshots/compatibility-info/recency/verified-seller/
  verified-reviews), shown per-product and folded into ranking as a new
  configurable weight. Explicitly **not** a claim about trading
  performance, profitability, or safety — every surface displaying it
  keeps that framing, per the Phase 5 brief's own instruction.
- **Platform analytics** (`AnalyticsEvent`, `src/lib/analytics/track.ts`)
  — deliberately doesn't duplicate what already has a dedicated table
  (favorites, downloads, purchases all already have one); it adds
  `PRODUCT_VIEW` as a time series (the pre-existing `Product.viewCount` is
  just a running counter with no history) and `SEARCH` query tracking
  (nothing recorded this before at all). No IP/user-agent/free-text PII
  stored — see the model's schema comment.
- **SearchService extended** to a generic, entity-tagged
  `search(query, {types, limit})` across products/news/signals
  (`/api/search`) — news/signals use plain `ILIKE`, not the tsvector-based
  ranking products get, since neither has a search-vector column/trigger
  yet (see `src/lib/search/postgres-search-service.ts`'s doc comments).
- **AI-readiness interfaces** (`src/lib/ai/`) — content-assistance
  operations only (summarize, recommend, tag, detect-duplicate); no real
  provider wired up, a `NoopAIProvider` stub throughout, matching the
  Stripe/M-Pesa stub pattern exactly. Deliberately excludes anything that
  would generate or auto-execute a trade — the brief explicitly rules that
  out, and nothing here should grow into it without that being a
  separate, deliberate decision.
- **Notification service unification** (`src/lib/notifications/notify.ts`)
  — new unified helper; existing 14+ call sites that independently called
  `createNotification()` + `enqueueEmail()` side by side were **not**
  mass-migrated (real regression risk for no functional gain, this late
  in a change) — `event-reminder-worker.ts` is migrated as a working
  example. New notification call sites should use the unified helper.
- **Structured logging** (`src/lib/logger.ts`) — JSON-shaped log lines,
  applied to every BullMQ worker and the payment webhook; not an
  error-monitoring *service* integration (no Sentry/equivalent — needs a
  real account this environment doesn't have, see `docs/OBSERVABILITY.md`
  for the integration point).
- **`/admin/queues`** — per-queue job counts + recent `SyncLog` runs.
  Deliberately minimal (not a full job browser/retry UI — that's a Bull
  Board integration, flagged as a follow-up).

## Calendar enhancement: automatic sync pipeline, revisions, timezones

Extends Phase 3's calendar (provider abstraction, `EconomicCalendarService`,
`runCalendarSync`) rather than replacing it — every file below is either new
or an additive change to an existing one; no calendar data or working
behavior was removed.

- **`AuthorizedCalendarProvider`** (`src/services/calendar/providers/
  authorized-provider.ts`) replaces the old `LicensedFeedCalendarProvider`
  stub — this is a real, working integration against Trading Economics'
  Calendar API (a licensed, documented commercial provider — **never Forex
  Factory**, per the ground rule at the top of this file), gated on
  `ECONOMIC_CALENDAR_API_KEY`. Its pure request/response mapping (Zod
  validation, impact/category/status mapping) lives in the sibling
  `authorized-provider-mapping.ts` specifically so it stays unit-testable
  with no `@/lib/env` dependency — importing `@/lib/env` anywhere eagerly
  parses `process.env` (see that file), which would otherwise force every
  test of this pure logic to also stub `DATABASE_URL`/`AUTH_SECRET`. The
  registry key changed from `licensed-feed` to `authorized` (nothing had
  seeded a `DataSource` row under the old key, so this was a safe rename —
  see `prisma/seed.ts`, which now seeds a **disabled** `authorized` row).
  HTTP calls retry transient failures with exponential backoff
  (`fetchWithRetry`, 3 attempts) independent of BullMQ's own job-level
  retry (`SYNC_JOB_OPTIONS`) — the former covers one flaky response inside
  a single job attempt, the latter covers the whole job failing outright.
  **Not yet exercised against a live Trading Economics account** — no real
  API key exists in this environment; it's validated against the
  documented response shape and a mocked HTTP layer instead (see that
  file's own doc comment and Testing below).
- **Revision tracking**: `EconomicEventRevision` (new model, migration
  `20260916004253_calendar_enhancement_pipeline`) logs one row per changed
  field per sync pass — computed by the pure `detectFieldChanges()`
  (`src/services/calendar/revision-detection.ts`, unit-tested), which also
  decides when to populate the new `EconomicEvent.revisedPrevious` column
  (only on a genuine revision of an already-reported `previous` value, not
  the first time it's populated). `getEventRevisionHistory()`
  (calendar-service.ts) is the read path; the event detail page shows it as
  an "Update history" section.
- **Cancellation, not deletion**: a `SCHEDULED` event (never
  `RELEASED` — see `EconomicEventStatus`) that a provider stops returning
  within the still-future part of the sync window is marked `CANCELLED`,
  never deleted — `detectDisappearedEvents()` (pure, unit-tested) computes
  the set difference. A `RELEASED` event rolling out of the window is
  normal (it already happened) and is correctly left alone — don't
  "fix" this into cancelling released events too; it was deliberately
  verified both ways (see Testing below).
- **Sync window** (`getSyncWindow()` in `sync-service.ts`) is one
  contiguous range — `ECONOMIC_CALENDAR_SYNC_RECENT_DAYS` behind "now"
  through `ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS` ahead — not two separate
  provider calls, so a sync pass stays one bounded request per source.
  `runCalendarSync()` now returns a richer `CalendarSyncResult` (inserted/
  updated/cancelled/revisions, on top of the shared minimal `SyncResult`
  that `newsSync`/`marketDataSync` also return — don't widen the shared
  `SyncResult` itself, extend it, or those two jobs' return types break).
  `SyncLog` gained `itemsInserted`/`itemsUpdated`/`itemsCancelled` columns
  (migration `20260916005508_sync_log_breakdown_counts`) so
  `/admin/data-sources`' new calendar status panel can show real
  per-run counts, not just a processed/failed total.
- **Timezone display** (`src/lib/calendar/timezone.ts`) uses the
  platform's own `Intl.DateTimeFormat` — deliberately **not** a new
  date-fns-tz/luxon dependency — for both formatting an instant in a zone
  and resolving that zone's current UTC offset (DST-correct, never a
  manually-added offset). Calendar defaults to `Africa/Nairobi`; the
  picker persists via a `calendar_tz` cookie for everyone and additionally
  to signed-in users' `CalendarPreference.timezone` via the existing "save
  as default" action. `CalendarTable`'s "Time (UTC)" column is gone —
  every caller now passes an explicit `timezone` prop (the two SEO
  per-currency/per-week pages pass the site default; the main `/calendar`
  page resolves the viewer's choice).
- **Two sync cadences, same job/pipeline**: `runCalendarSync()` takes an
  optional `windowOverride` (`{recentDays, upcomingDays}`) and `jobName`,
  defaulting to the env-configured full window logged as `"calendarSync"`.
  `npm run sync:trigger:calendar-today` (`scripts/trigger-calendar-sync-
  today.ts`) enqueues the same `calendarSyncQueue`/worker with a narrowed
  `{recentDays: 0, upcomingDays: 1}` window, logged as
  `"calendarSyncToday"` — meant for a tighter external-cron cadence (e.g.
  every 5-15 min) alongside a slower full-window cron
  (`ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES`, e.g. hourly), so a same-day
  actual-value release is picked up faster without re-requesting the
  whole multi-month window every time. `/admin/data-sources` also has a
  "Sync today's events only" button next to the existing "Run calendar
  sync now" (`triggerCalendarSyncTodayAction`) — both cadences share one
  `SyncLog` table and are distinguishable by `jobName` in the "Recent
  sync runs" table there. This is additive to, not a replacement for, the
  external-cron model below — there is still no in-process scheduler.
- **Two-level refresh**: level 1 is `runCalendarSync()` itself (via the
  existing `calendarSyncQueue`/worker — an admin can also trigger one
  on-demand with a new "Run calendar sync now" button at
  `/admin/data-sources`, `triggerCalendarSyncAction()`). Level 2 is
  `CalendarAutoRefresh` (`src/components/calendar/calendar-auto-refresh.tsx`),
  a client component that calls Next's `router.refresh()` on an interval
  (`ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS`, default 60s, `0` disables
  it) — this re-runs the calendar page's server components and patches
  only the changed RSC payload, no full browser reload, no hand-rolled
  client-side fetch/re-render. `CalendarUpdateEvent`
  (`src/services/calendar/realtime.ts`) is an inert typed shape for a
  future push transport (SSE/WebSocket) — nothing produces or consumes it
  today; polling is sufficient at this scale, per the enhancement's own
  brief not to add that complexity yet.
- **New `/api/calendar/*` routes** (`events`, `event/[id]`, `upcoming`,
  `date/[date]`, `range`, plus the pre-existing base `/api/calendar`
  upgraded to the same contract) all go through one shared parser/
  responder (`src/app/api/calendar/_shared.ts`) — a `from`/`to` range is
  validated with Zod, never handed to Postgres unchecked. None of these
  call a provider directly; they're the same Postgres-only read path
  (`calendar-service.ts`) the pages use, so a slow/down upstream provider
  can never make one of these requests slow. An optional `timezone` query
  param adds a computed `local: {date, time}` field per event without
  changing the canonical UTC `eventTime`.

## Authentication enhancement: Google sign-in, forgot password, password toggle

Extends the existing Auth.js setup (Credentials + Google, PrismaAdapter,
JWT sessions — see "Architecture at a glance" above) — nothing here
replaces it, and no user, password, or role was touched by any migration.

- **Session lifetime** (`SESSION_MAX_AGE_SECONDS` in `src/lib/auth.ts`,
  `session.maxAge`): explicitly set to 1 year, up from Auth.js's undeclared
  30-day default. "Stay signed in until I sign out, even after closing the
  browser" was already half-true before this — Auth.js's JWT-strategy
  session cookie always carries a real `Expires` (verified directly against
  `@auth/core`'s source: `cookieExpires = now + session.maxAge`, not a
  browser-session-only cookie), and re-issues that cookie with a fresh full
  window on any request past `updateAge` (unchanged, 24h) since the last
  one — so closing/reopening the browser was never the gap. The 30-day
  default was: a user who didn't open the site for 30+ consecutive days got
  signed out. A year comfortably covers realistic usage without landing on
  a literal never-expires cookie. Verified with a raw HTTP sign-in (`curl`,
  bypassing the fact that `document.cookie` can't read this — it's
  `HttpOnly`) showing `Expires` exactly one year out.
- **Google account linking** (`signIn` callback in `src/lib/auth.ts`, deciding
  via the pure `decideGoogleAccountLinking()` in `src/lib/auth-linking.ts` —
  unit-tested there with no DB/Auth.js dependency, same "pure decision, I/O
  shell around it" split as `detectFieldChanges`/`shouldDispatchHighImpactAlert`
  elsewhere in this codebase): Google was already a registered provider
  before this change (conditional on `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`);
  what was missing was *safe* linking when a Google sign-in's email matches
  an existing credentials-registered account. Deliberately does **not** use
  Auth.js's own `allowDangerousEmailAccountLinking` (it trusts any
  provider's email claim, unverified) — instead, the callback checks
  Google's own ID-token `email_verified` claim (independent proof the
  requester controls that email) and, if true and no Google `Account` row
  is linked yet, manually creates that `Account` row pointing at the
  existing `User` *before* returning — so Auth.js's own subsequent adapter
  lookup finds it and logs the person into their existing account (same
  id, same role, same everything) instead of hitting its built-in
  "OAuthAccountNotLinked" guard or creating a duplicate. An unverified
  Google email that doesn't already have a linked account is refused, not
  silently accepted. The redirect-to-Google half of this (button →
  `/api/auth/signin/google` → Google's real authorization server with the
  configured `client_id`) was verified by temporarily setting a
  placeholder `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, confirming Google's
  own server received a correctly-formed request (it responded with its
  own "invalid_client" — expected, since the placeholder isn't a real
  registered app) — then reverting `.env` immediately after. Completing an
  actual Google sign-in needs a real Google Cloud OAuth client, which this
  environment doesn't have.
- **Forgot password** (`src/features/auth/password-reset-service.ts`,
  `src/lib/security/password-reset-token.ts`): a new `PasswordResetToken`
  table (migration `20260916104108_password_reset_tokens`) — deliberately
  separate from Auth.js's own `VerificationToken` adapter table (that one
  is for a magic-link/passwordless Email provider this app doesn't use,
  and stores its token in plaintext, which a reset flow shouldn't do).
  Only a SHA-256 hash of the token is ever stored; the raw token exists
  only in the emailed link. Single-use (consumed in the same transaction
  that updates the password, which also invalidates every other
  outstanding token for that user) and expires after 1 hour.
  `POST /api/auth/forgot-password` always returns the same generic
  response regardless of whether the email matched a resettable account
  (no password, banned, or unknown emails all produce the identical
  response and no observable side effect) — never branch that response on
  the lookup result, or the endpoint becomes an email-enumeration oracle.
- **Change password** (signed-in, `/dashboard/security`,
  `src/features/auth/actions.ts`'s `changePasswordAction`) is a separate,
  simpler path from the above — always requires the current password (no
  mailed token), rate-limited per user. A Google-only account (no
  `password` set) sees an explanatory message instead of a broken form.
- **Password visibility toggle** (`src/components/ui/password-input.tsx`)
  wraps the existing `Input` primitive — used everywhere a password field
  appears (sign-in, sign-up, reset-password, change-password) instead of
  each page rolling its own. The toggle button is a real, keyboard-
  reachable `<button>` with a dynamic `aria-label`/`title` ("Show
  password"/"Hide password"), not a `tabIndex={-1}` decoration.
- **A real, previously-hidden e2e regression was found and fixed in the
  same pass**: the sign-in/sign-up redesign (an earlier change) replaced
  literal `placeholder="Email"`/`"Password"` text with a proper
  `<label>` + descriptive placeholder (`"you@example.com"`, `"Your
  password"`), but every e2e spec that signs in or signs up — including
  the shared `signIn()` helper in `e2e/helpers.ts`, used by most of the
  suite — still matched on the old placeholder text via
  `getByPlaceholder("Email"/"Password")`, which silently stopped matching
  anything. This had never been caught because the full suite wasn't run
  again after that redesign until this change's own verification pass.
  Fixed by switching every one of those selectors to `getByLabel(...)`
  (the semantically correct, more robust anchor now that real `<label>`
  elements exist) — and then fixing a *second*, self-inflicted issue from
  that same change: `getByLabel("Password")` ambiguously matched both the
  password `<input>` and the new visibility-toggle button's `aria-label="Show
  password"` (both contain "password" as a case-insensitive substring),
  requiring `{ exact: true }` wherever a bare "Password"/"New password"
  label is queried alongside a toggle button or another field whose label
  contains it. **Lesson**: a placeholder is copy, not a contract — prefer
  `getByLabel`/`getByRole` in tests over `getByPlaceholder` so a future
  redesign's copy changes don't silently break test coverage the same way
  again; and re-run the *full* e2e suite after any shared-page redesign,
  not just the specs that seem related.

## Calendar page reorganization: day-grouped layout, real date ranges

Edits the `/calendar` page and its two direct components only — no other
page, no new data source, no architecture change. Forex Factory's calendar
is cited here purely as a **layout** reference (day-grouped rows, compact
columns), exactly as README.md already frames it ("structurally inspired
by... Forex Factory Calendar (filtering)") — never as a data source; the
ground rule against scraping it stands unchanged.

- **`CalendarTable` groups events by viewer-local day** (`src/components/
  calendar/calendar-table.tsx`), with one heading row per day instead of a
  repeated Date cell on every row — the single most recognizable trait of
  that reference layout. `formatInTimezone()` (`timezone.ts`) gained a
  `weekday` field for the heading text; its existing `date` string doubles
  as the grouping key, since two instants on the same viewer-local day
  always format to the same string.
- **Decluttered from 11 columns to 7** (Time/Currency/Impact/Event/Actual/
  Forecast/Previous): dropped the separate Country column (redundant with
  Currency for this audience), dropped the separate Deviation column
  (replaced by coloring the Actual cell green/red against forecast —
  Forex Factory's own convention: purely "beat vs. missed forecast," not a
  claim about whether that's economically good), and dropped the separate
  "Details/View" link column (the event title itself is now the link,
  matching the stretched-link-adjacent pattern used elsewhere in this
  codebase rather than a dedicated column for one click target). Impact
  reads as a small colored dot + label instead of a full pill badge.
- **A real From/To range picker** (`CalendarFilters`) replaces what was
  actually a broken control before this change: the old single "custom"
  date input always requested exactly a 1-day span
  (`getCustomRange(date, 1, ...)` — the `1` was hardcoded in `page.tsx`),
  so a multi-day/multi-month custom range was never actually reachable
  through the UI despite `getCustomRange()` itself supporting an arbitrary
  day count. Added `getRangeBetween(fromIso, toIso, offsetMinutes)` in
  `date-ranges.ts` (pure, unit-tested, inclusive of both endpoints,
  guards an inverted range) plus "This Month" and "Next 3 Months" quick
  presets, landing as `?preset=range&from=...&to=...`.
- **Pagination**, previously absent: a single week rarely exceeds the
  250-row page cap `calendar-service.ts` already enforced, but a 3-month
  range genuinely can once real provider data is flowing — silently
  truncating at 250 with no indication would be a real correctness gap
  for exactly the range this change adds. `page.tsx` now reads a `page`
  query param and renders Prev/Next links preserving every other filter.
- **`ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS` default raised from 30 to 90**
  (still capped at 90 in `env.ts`) — so the sync window actually covers
  the new "Next 3 Months" quick range once a real provider is enabled;
  a no-op today since `manual`/no-credentials sync pulls nothing new
  regardless of window size.
- **A real, pre-existing responsive bug found and fixed in the same
  pass**: at narrow widths the whole page scrolled horizontally, not just
  the table — a classic flex-column min-content propagation issue
  (`src/app/layout.tsx`'s root wrapper `<div className="flex flex-1
  flex-col">` had no `min-w-0`, so a wide flex-item descendant's
  min-content size pushed the *entire* chain wider than the viewport
  instead of stopping at the table's own `overflow-x-auto` container).
  Fixed with `min-w-0` on that one shared wrapper (inert on every other
  page — it only removes an implicit width floor that only matters when
  content would otherwise force overflow) plus `w-full min-w-0` on the
  calendar page's own `<main>`, which turned out to be necessary too:
  a stretched flex-column item's cross-axis width isn't reliably capped
  by `min-width: 0` alone without an explicit `width` to stretch *to*.
- **Provider research** (the brief asked to look before changing
  anything): Trading Economics (already the `AuthorizedCalendarProvider`
  integration — see "Calendar enhancement" above) supports arbitrary
  `d1`/`d2` date ranges including 3+ months, so no second provider
  integration was added — one already exists and already fits. Financial
  Modeling Prep's `economic_calendar` endpoint and Finnhub's `/calendar/
  economic` are the closest viable alternatives if Trading Economics
  access/pricing doesn't work out (both take explicit `from`/`to`
  params); Investing.com and Forex Factory itself have no official public
  API, so scraping either would carry the same legal exposure this
  project's ground rule already rules out. **"Live and real" data still
  needs a real API key** — this environment has none (see "Known
  follow-ups"); nothing here fabricates placeholder numbers pretending to
  be real. The only rows visible right now are the pre-existing
  admin/e2e-fixture ones.

## Homepage hero: live market-data chart

Replaces only the homepage's hero `<section>` (`src/app/page.tsx`) with an
interactive instrument chart — nothing else on the homepage, and no other
page, was touched. New, self-contained infrastructure under
`src/lib/market-data/` and `src/app/api/market-data/`, following the same
provider-abstraction pattern as payments/storage/email/calendar (see
"Provider abstractions" above) rather than reusing the unrelated
`DataSourceKind.MARKET_DATA` / `runMarketDataSync` periodic-bulk-sync stub
— that one is a scheduled batch job with no instrument model; this is an
interactive, on-demand/streaming path with its own `Instrument` cache
model, deliberately kept separate.

- **`MarketDataProvider`** (`src/lib/market-data/types.ts`): `searchSymbols`/
  `resolveSymbol`/`getHistoricalBars`/`getLatestQuote`/`subscribeBars`/
  `unsubscribeBars`. **`TwelveDataProvider`** (`src/lib/market-data/
  providers/twelvedata-provider.ts`) is the real implementation — Twelve
  Data (https://twelvedata.com/docs), covering forex/metals/stocks with
  historical OHLC, symbol search, and a real-time WebSocket feed, gated on
  `MARKET_DATA_API_KEY` (never Forex Factory/TradingView/Google/Yahoo
  Finance scraping — same rule as the calendar provider). Every method
  throws a clear "not configured" error until a real key is set; the chart
  catches this and renders an explicit "Live market data isn't connected
  yet" panel instead of fabricating prices — this environment has no real
  key, so that's the state it's in right now (see "Known follow-ups").
  **Not yet exercised against a live Twelve Data account** — validated
  against the documented response shape (`twelvedata-mapping.ts`,
  unit-tested) and exercised end-to-end (search → asset-class mapping →
  instrument-cache upsert/dedup, historical-bar ordering, quote mapping)
  with a mocked HTTP layer against this environment's real Postgres, the
  same technique and caveat as `AuthorizedCalendarProvider` — re-verify
  against a real key before enabling in production.
- **Pure logic split out for testability**, same reasoning as
  `authorized-provider-mapping.ts`/`revision-detection.ts`: `twelvedata-
  mapping.ts` (Zod-validated request/response mapping, asset-class
  inference — metals/commodities like XAU/USD are recognized by a known
  base-currency-code list, since Twelve Data's `instrument_type` doesn't
  distinguish them from real forex pairs), `tick-aggregator.ts` (turns the
  WebSocket's raw price ticks into OHLC candle updates via interval
  bucketing — Twelve Data's stream pushes ticks, not bars), and
  `subscription-registry.ts` (generic ref-counted subscribe/unsubscribe
  bookkeeping, deciding *when* to open/close the shared upstream
  connection, not *how*). All three are unit-tested with no network/DB.
- **No raw WebSocket proxy to the browser**: this app has no custom Node
  server (`next dev`/`next start` only), so `/api/market-data/stream`
  (`route.ts`) is a Server-Sent Events endpoint instead — a `ReadableStream`
  response, same "server-streaming where supported" allowance the brief
  itself named. The browser holds one same-origin `EventSource`;
  `TwelveDataProvider` is the only thing that ever opens a connection to
  Twelve Data itself, server-side, sharing one upstream WebSocket
  connection per process across every subscriber (ref-counted — see
  `subscription-registry.ts`) rather than one per browser tab. Changing
  instrument/timeframe closes the previous `EventSource` before opening
  the next (browser's own SSE `close()` → the route's `request.signal`
  `abort` handler → `provider.unsubscribeBars()`), so no orphaned
  subscription is left running — literally the brief's own "resolve →
  load → subscribe → unsubscribe previous" sequence. Reconnection is the
  browser's native `EventSource` retry behavior (no custom client-side
  reconnect loop); the shared upstream WebSocket separately reconnects
  with exponential backoff and re-subscribes every retained symbol (see
  `TwelveDataStream` in `twelvedata-provider.ts`).
- **`Instrument` model** (`prisma/schema.prisma`, migration
  `20260917061029_market_data_instruments`) is a lazily-populated cache of
  instruments a search/resolve call already returned — never a bulk-loaded
  full catalogue (`src/lib/market-data/instrument-cache.ts`'s
  `upsertInstrumentsBestEffort()`, fire-and-forget off the search route's
  request path, same "never on the critical path" posture as
  `enqueueEmail`). `/api/market-data/search` is also rate-limited and
  Redis-cached briefly (`cacheWrap`, 30s) — a user typing doesn't re-hit
  the provider per keystroke.
- **`/api/market-data/{search,resolve,bars,quote,stream}`** are the only
  read path; the chart never calls Twelve Data directly. `bars` defaults
  to a per-interval bounded lookback (2 days for 1m up to 10 years for
  1M) when no explicit `from`/`to` is given — never one unbounded
  history request — and caches that default-range response briefly
  (15-60s depending on interval). All five are rate-limited by IP
  (`checkRateLimit`, same fail-open posture as the rest of the app).
- **`HeroChart`** (`src/components/market/hero-chart.tsx`, Client
  Component) uses `lightweight-charts` — TradingView's free, MIT-licensed
  charting library (`npm install lightweight-charts`, zero new `npm audit`
  findings), **not** TradingView's separate paid Advanced Charting
  Library/Datafeed API the brief named as the preference. That library
  isn't distributed via npm and needs an approved licensing agreement with
  TradingView, which this environment doesn't have; `lightweight-charts`
  covers every requested capability (candlestick/line/area, zoom, crosshair
  OHLC readout, live updates) except drawing tools/indicators, which the
  brief's own "Future features" section says not to build yet anyway.
  Renders candlestick/line/area (toggle), 9 timeframes (1m-1M), an
  instrument search (`InstrumentSearch`, debounced, grouped by asset
  class), a few quick-select symbol chips, and price/change/%change in the
  header — all wired through the API routes above, never a
  provider/env import in a Client Component.
- **`AssetClass`** (`FOREX`/`METAL`/`COMMODITY`/`STOCK`/`INDEX`/`OTHER`)
  matches the brief's grouping; `COMMODITY` exists in the schema/type for
  a future non-metal commodity provider (e.g. oil/agricultural) but
  nothing maps into it yet — Twelve Data's documented symbol_search shape
  doesn't distinguish one from `METAL`/`OTHER` without live-account
  verification, so it's left unmapped rather than guessed (see
  `twelvedata-mapping.ts`'s doc comment).

## Hero chart: dark theme, wider layout, and scratch annotations

Small, additive follow-ups to the homepage hero chart — no engine swap,
no architecture change:

- **Dark theme**: `HeroChart`'s `createChart()` options now use a black
  `layout.background`, light `textColor`, and dark grid/border colors
  (`hero-chart.tsx`) — only the chart's own plot area, not the
  surrounding card/header, which stays light. The "not configured"/
  "error"/"loading" overlays were updated to match (dark background,
  light text) so they don't look like a stray white box on the new black
  canvas.
- **Wider container**: the homepage's wrapper around `<HeroChart>`
  changed from `max-w-4xl` to `max-w-5xl` (`src/app/page.tsx`) — closer
  to the hero section's own `max-w-6xl` bound, reducing the side gaps,
  without going edge-to-edge.
- **`ChartDrawingLayer`** (`src/components/market/chart-drawing-layer.tsx`)
  adds pencil/line/text annotation tools + a color palette, as a plain
  `<canvas>` absolutely positioned on top of the chart — entirely
  independent of `lightweight-charts`, which has no drawing-tools API of
  its own (this is exactly the kind of thing TradingView's paid Advanced
  Charting Library would provide natively — see the section below for why
  that isn't in use here yet). Needs an explicit `z-10`: lightweight-charts'
  own internal canvases apparently set their own z-index, so a sibling
  overlay with the default `z-index: auto` renders *underneath* them
  despite being later in the DOM — a real bug hit and fixed while
  building this, not a hypothetical. Only mounts once `status === "ready"`
  (real chart data loaded). Pointer events pass through to the chart
  underneath (`pointer-events-none`) unless a draw tool (not "cursor") is
  selected, so normal pan/zoom/crosshair still works by default.
  **Annotations are client-side/session-only** — there's no backend model
  for them, so they're lost on reload; a deliberate scope cut for a first
  pass. The canvas's pixel size tracks the chart container via
  `ResizeObserver`, but existing strokes don't rescale with it — also a
  known, acceptable simplification for scratch annotations, not a bug.

## TradingView Advanced Charting Library (in progress, not yet wired in)

Preparatory work for swapping the homepage hero chart's engine from
`lightweight-charts` to TradingView's actual Advanced Charting Library,
once its files are available in this project — **not done yet**, and the
homepage still renders the existing `HeroChart` (`lightweight-charts`,
see "Homepage hero" above). Don't wire `TradingViewChart` into any page
until the library is actually present and this has been visually verified
— mounting it against a missing script is exactly the "library-missing"
state it's designed to show instead.

- TradingView doesn't have a public, fetchable "Datafeed API" of its own
  — the Advanced Charting Library is a free, approval-gated JS charting
  widget TradingView distributes as a private GitHub repo once an
  application is approved (never via npm). Its "Datafeed" is a JS
  *interface* (`onReady`/`searchSymbols`/`resolveSymbol`/`getBars`/
  `subscribeBars`/`unsubscribeBars`) that the integrating site implements,
  backed by its own real data source — "redistribution permission" from
  TradingView is about displaying their chart widget/branding, not a
  license to pull TradingView's own market data. **Never treat TradingView
  itself as a data source** — that's exactly the scraping/redistribution
  the ground rule at the top of this file already forbids; this Datafeed
  is backed by `TwelveDataProvider` (the same provider and
  `/api/market-data/*` routes the existing hero chart already uses), not
  by anything fetched from TradingView.
- **`src/components/market/tradingview/create-datafeed.ts`** implements
  that interface entirely against this app's own same-origin
  `/api/market-data/*` routes (REST for search/resolve/bars, SSE for
  `subscribeBars`/`unsubscribeBars` — identical transport to
  `HeroChart`'s, just reshaped into the Datafeed callback contract instead
  of driven imperatively). Pure request/response mapping (resolution
  string ↔ `BarInterval`, `InstrumentSummary` ↔ TradingView's search/symbol
  shapes, seconds ↔ milliseconds for bar timestamps) is split into
  `resolution-mapping.ts`, unit-tested with no DOM/network — same "pure
  logic, I/O shell around it" split as `twelvedata-mapping.ts`.
  `minmov`/`pricescale` default to a 5-decimal forex convention (correct
  for most forex pairs, an approximation elsewhere) since Twelve Data's
  symbol search doesn't return a decimal-places field — a known
  simplification, not a silent guess, see that function's own doc
  comment.
- **`types.ts`** hand-declares the small slice of TradingView's public
  `IBasicDataFeed`/`LibrarySymbolInfo`/etc. shapes this adapter needs —
  not copied from the library's own `charting_library.d.ts` (which ships
  inside the license-gated repo, not present in this project). Once the
  real library is added, prefer importing its actual types over these.
- **`tradingview-chart.tsx`** loads the library's own script tag at
  runtime from a configurable `libraryPath` (default `/charting_library/`)
  and mounts `new TradingView.widget({ datafeed: createDatafeed(), ... })`
  — if the script 404s or `window.TradingView` never appears, it shows an
  explicit "Charting Library not installed" message instead of a blank
  chart or a crash, the same honest-degradation posture as `HeroChart`'s
  "not configured" state for a missing API key.
- **To finish this**: get the library files from TradingView (private
  GitHub repo, granted after their approval process) and place them at
  `public/charting_library/` (gitignored — a license-gated third-party
  asset, not something to commit; each environment that needs it adds its
  own copy). Then decide whether `TradingViewChart` replaces `HeroChart`
  on the homepage outright or becomes a separate opt-in view, verify it
  renders/streams correctly, and update this section once it's actually
  wired in.

## Product cover photos

Every listing can carry a cover photo, shown **above the title** wherever a
product appears. Extends the existing `ProductImage` model (position 0 =
the cover, already what `ProductCard` and every list query read as
`images[0]`) — no schema change, no migration.

- **Upload**: the wizard's "Basic information" step has a cover picker
  *above* "Product name" (`CoverPhotoPicker`, `src/components/seller/
  cover-photo-field.tsx`); the seller edit page has `CoverPhotoManager`
  above the title/form (uploads and replaces immediately). Both use the
  existing presign → PUT → attach flow via `uploadAndSetCover()`.
  Wizard detail: a draft (and so a `productId`) doesn't exist until the end
  of step 5, so the chosen file waits in memory and uploads right after the
  draft is created — if that upload fails, the draft is **still created**
  and the seller gets a retry link on the last step.
- **Server**: `setCoverImage()` (`asset-service.ts`, `assetType: "cover"`
  on `POST /api/seller/products/[id]/assets`) *replaces* the product's
  image rows (one cover at a time) and best-effort deletes the old object.
  It only accepts a key under `products/<thatProductId>/image/`
  (`isProductKey`, `src/lib/storage/product-keys.ts`) — the attach step
  otherwise trusts a client-supplied string. The older `assetType: "image"`
  route (append-only gallery image) still exists, unused by the UI.
- **Display**: `ProductCover` (`src/components/marketplace/
  product-cover.tsx`) is the shared display + "No image" fallback for
  thumbnails (cart, dashboard orders/licenses/subscriptions, seller "My
  products", admin moderation list) and the detail-page banner (now above
  the title; also feeds JSON-LD `image` and Open Graph). `ProductCard`
  already had the cover-above-title layout. Queries that select their own
  product columns use `productCoverSelect` (`product-repository.ts`).
- **Deliberately optional**: not requiring a cover keeps listing possible
  when storage isn't configured (as on production today) and keeps
  `product-lifecycle.spec.ts` valid (CI has no MinIO). Cover-less products
  show a neutral placeholder; the picker is labelled "(recommended)".
- **Two storage fixes found while testing this** (both affect *every*
  presigned upload, not just covers): (1) recent `@aws-sdk/client-s3`
  bakes `x-amz-checksum-crc32=AAAAAA==` (checksum of an *empty* body) into
  presigned PUT URLs, which S3/R2 reject for a real file —
  `requestChecksumCalculation: "WHEN_REQUIRED"` in `s3-provider.ts` stops
  that; (2) `next dev` couldn't display images from a localhost MinIO
  (image optimizer's SSRF guard) — `next.config.ts` sets
  `dangerouslyAllowLocalIP` in non-production only. **The checksum fix has
  only been verified against a local S3 emulator (the signed URL no longer
  carries the checksum params), not real S3/R2** — confirm with a real
  bucket.
- **Production needs storage configured before any upload works** — see
  `docs/DEPLOY_HOSTINGER.md` (`STORAGE_*` + bucket CORS + public read for
  `products/*/image/*`).

## Live calendar feed: Finance Calendar (3-month window, no worker needed)

The economic calendar is now fed by **Finance Calendar**
(https://www.financecalendar.com/api/) — free, no API key, free for
commercial use *with a visible link back*. Additive: the `CalendarProvider`
abstraction, `runCalendarSync`, `EconomicCalendarService`, revision
tracking and the calendar UI are all reused; nothing was replaced.

- **`FinanceCalendarProvider`** (`src/services/calendar/providers/
  financecalendar-provider.ts`, registered as `financecalendar`) + pure,
  unit-tested `financecalendar-mapping.ts` (tests use real captured
  payloads). It is called **only from the sync job**, never from a page or
  API request. Verified against the live API: (1) **`limit` defaults to 100
  and silently truncates** — a 3-month window loses its back half with no
  error — so `limit=500` is always sent, and a response that fills it is
  bisected; (2) ranges cap at 92 days and the default window is 93, so it's
  split into evenly sized requests (`splitDateRange`); (3) a changed
  response shape throws, so a sync fails loudly and cached rows stay.
- **The feed is not a full forex-calendar feed** — be honest about it:
  ~170 events per 90 days (~70 distinct series: major US/UK/EU/JP/CA/AU/NZ/
  CH/CN releases, central-bank decisions, market holidays), **no
  country/currency field** (inferred from the event name by an ordered rule
  table; an unrecognised one is kept under currency `GLOBAL` and logged,
  never dropped), `actual`/`consensus`/`prior` are **free text truncated by
  the API** (e.g. "-23,000 NFP vs +80,000 expec…"), and **consensus
  (Forecast) is only filled ~2 days before a release**, so the Forecast
  column is mostly empty. There is no id: `externalId` is
  `financecalendar:<event page slug>`. Market-holiday pages ("Is the Stock
  Market Open on …") map to `impact: HOLIDAY`. Re-check the mapping if the
  feed changes shape; `actualColor()` in `calendar-table.tsx` only colours
  numeric actuals, so these text values render plain.
- **`EconomicEvent.allDay`** (migration `20260920070620_calendar_event_all_day`,
  additive `BOOLEAN NOT NULL DEFAULT false`): the feed lists central-bank
  decisions and holidays as "All day". `eventTime` is then a noon-UTC
  same-day anchor (never midnight — that slides to the previous day for
  viewers west of Greenwich); `CalendarTable` shows "All day" and lists
  those rows first within their day.
- **Sync trigger without Redis/cron** (`src/services/calendar/auto-sync.ts`):
  BullMQ workers and `crontab` don't exist on the Hostinger plan, so
  `/calendar` calls `runCalendarSyncIfDue()` in `after()` (never blocking the
  response): if a source's `lastSyncAt` is older than
  `ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES` (60) one sync runs. Which
  process runs it is an **atomic compare-and-set on `DataSource.lastSyncAt`**
  (`claimSource`) — concurrent views/instances never double-run (tested with
  simultaneous forced triggers). A never-synced source also backfills 30
  days of history. A failed source retries in 10 minutes, not an hour, judged
  **per source from its own status** (another source's rows would otherwise
  mask the failure — a real bug caught in testing).
  `ECONOMIC_CALENDAR_AUTO_SYNC=false` turns the page trigger off —
  **Playwright and CI set it** so tests never call the external API. The
  client-side `CalendarAutoRefresh` (60s) means an open tab picks up a fresh
  sync within about a minute, and *its* refresh also runs the due-check.
- **Optional cron**: `GET/POST /api/cron/calendar-sync` with
  `Authorization: Bearer $CRON_SECRET` (timing-safe compare, rate-limited;
  **404 unless `CRON_SECRET` is 16+ chars** — the length is checked in the
  route, not the env schema, so a weak value can never crash env parsing and
  take the site down). Same due-check; `?force=1` skips it but still refuses
  to overlap a run from the last minute.
- **The default source registers itself** (`listCalendarSourcesEnsuringDefault`)
  because production's `data_sources` is never seeded. Create-only — an
  admin-disabled row is never re-enabled — and it checks real rows each time
  (an in-memory "done" flag broke when the row was deleted under a running
  server; found in testing).
- **`runCalendarSync` changes** (behaviour-preserving): one batched
  `findMany` instead of `findUnique`+`upsert` per event (an hourly pass is
  ~2 upstream requests and ~1.5s, not hundreds of DB round trips);
  `createMany` for new rows; unchanged rows skip their write
  (`needsRowUpdate`, unit-tested) and only get `lastSyncedAt`; **an empty
  provider response never triggers cancellation detection** (an outage must
  not mass-cancel every upcoming event). Alerts/revisions/cancellation for
  real changes are unchanged.
- **Attribution** (`CalendarAttribution`): each provider declares
  `attribution` on the `CalendarProvider`; the component renders one for
  every calendar `DataSource` row (even disabled — its stored events remain
  on the page), on the calendar, currency, week and event pages. Switching
  providers changes the credit with no UI edit.
- **Switching providers later** (e.g. Trading Economics): enable the
  `authorized` row and **disable `financecalendar`** at `/admin/data-sources`.
  Run only one at a time — providers use different `externalId` prefixes, so
  two enabled feeds would list the same real event twice.
- Verified against the live API + local Postgres (218 events, first run
  1.9s, re-sync 1.4s, zero duplicates, change/revision, cancellation and
  reappearance, empty-response guard, 500/garbage outage handling), in dev
  *and* a production build (`next start`).

## Testing

- `npm run test` (Vitest) — pure-logic unit tests only (authorization matrix,
  upload validation, ranking score math). Nothing here touches Postgres/Redis.
  The calendar enhancement's pure logic follows this exactly —
  `revision-detection.test.ts` and `authorized-provider-mapping.test.ts`
  cover field-diffing, revision recording decisions, disappearance
  detection, Zod validation/rejection, and impact/category/currency
  mapping, all with no DB or network access. **The full sync pipeline
  against a real database** (insert, revision + `revisedPrevious`,
  duplicate prevention on a no-op re-sync, cancellation vs. a `RELEASED`
  event correctly staying untouched, and provider-failure data
  preservation with real retry/backoff) was verified once, end-to-end,
  with a one-off script that mocked `global.fetch` and ran
  `runCalendarSync()` against this environment's real Postgres — not
  committed (per the "nothing here touches Postgres" rule above), and not
  yet run against a live Trading Economics account (no real API key
  exists here). Re-verify against a real key/sandbox before flipping
  `ECONOMIC_CALENDAR_PROVIDER=authorized` in production.
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
  seed's data either; add to `global-setup.ts` instead. Phase 3 added one
  fixed `EconomicEvent`/`NewsArticle`/`NewsCategory`/`DataSource` fixture the
  same way; Phase 4 added one published `SUBSCRIPTION`-priced product
  (`e2e-subscription-product`) alongside the existing `e2e-free-product`.
- The fixed e2e accounts and fixtures are upserted, not recreated per run —
  specs that assert on their alert-subscription/toggle state must not assume
  a starting direction (e.g. `AlertSubscribeButton`'s "subscribed" vs.
  "not subscribed"), since a prior run may have already flipped it. Check
  the current state first and assert the flip, not a fixed target state
  (see `calendar.spec.ts`).
- A plain `<form action={serverAction}>` with no redirect and no pending-state
  UI (e.g. `signals/new`'s publish form) resolves its `click()` as soon as the
  event dispatches — Playwright does not wait for the action's round trip.
  Follow it with `await page.waitForLoadState("networkidle")` before asserting
  on data the action just wrote, or the very next navigation can race the
  mutation's commit (the write still succeeds — it just isn't visible yet).
- File-upload steps are skipped in `product-lifecycle.spec.ts` — CI has no
  MinIO/S3 service, so presigned uploads have nowhere to land. The wizard's
  Next button on those steps is exercised (so a broken upload step's UI would
  still be caught), just not an actual file transfer.
- `page.request` (Playwright's raw HTTP client, used for the license-API and
  checkout-idempotency specs) is **not** a browser `fetch()` call — it
  doesn't automatically send an `Origin` header the way in-page JS does. A
  route protected by `assertSameOrigin()` (e.g. `/api/checkout`) needs that
  header set explicitly in the request (`checkout.spec.ts`'s idempotency
  test does this); routes meant for a non-browser caller (the license APIs)
  deliberately don't call `assertSameOrigin()` at all — see "Phase 4" above.

## Commands

- `npm run dev` / `npm run build` / `npm run test` (Vitest) / `npm run test:e2e`
  (Playwright) / `npm run typecheck` / `npm run lint`
- `npm run db:migrate` (dev migration), `npm run db:seed`, `npm run db:studio`
- `npm run worker:email` / `worker:calendar-sync` / `worker:news-sync` /
  `worker:market-data-sync` / `worker:event-reminder` /
  `worker:subscription-renewal` — long-running BullMQ workers (each `tsx
  src/lib/queue/workers/*.ts`); `npm run sync:trigger` enqueues one
  calendar+news+market-data sync pass (full window) and exits; `npm run
  sync:trigger:calendar-today` enqueues a calendar-only, today-window-only
  pass for a tighter cadence (see "Calendar enhancement" below); `npm run
  subscriptions:renew` enqueues one product-subscription renewal pass and
  exits — all three for wiring to an external cron (renewal wants a daily
  cadence, full-window sync can run more often, today-only sync more often
  still).
- `docker compose up` starts Postgres, Redis, and MinIO for local dev — copy
  `.env.example` to `.env` first.

## Known follow-ups (intentionally deferred, not oversights)

- No real payment provider wired up — `PAYMENT_PROVIDER=manual` marks orders
  paid synchronously so the full cart→checkout→license/subscription flow, the
  webhook route, and refunds are all testable before Stripe/M-Pesa are
  implemented against the existing `PaymentProvider` interface (`createCharge`/
  `parseWebhook`/`refundCharge`, all three now real, working operations —
  see "Phase 4" above). When a real provider is wired in, prefer Pesapal or
  an M-Pesa Till integration over Stripe for this market, per product
  direction — applies to both marketplace checkout and signal subscriptions.
- `/api/licenses/verify` is a real, working check against this app's own
  License/LicenseActivation records (see "Phase 4" above) — but it is not a
  DRM mechanism baked into a compiled `.ex4`/`.ex5`. Nothing stops a buyer
  from redistributing their copy of a downloaded file itself; this only
  stops a copy without a valid key from getting a "valid" verify response.
  Don't tell a seller unauthorized copies of their EA can't run.
- Vendor payout *processing* (Stripe Connect / M-Pesa B2C — actually moving
  money) is not built — `Payout` records the request and an admin manually
  marks it paid once money has moved through whatever channel is in use;
  see "Phase 4" above.
- Refunds only support the whole order, not a single item within a
  multi-item order — a deliberate scope limit (see "Phase 4" above), not an
  oversight.
- Invoices are a printable HTML page (browser print-to-PDF), not a
  generated PDF file — no PDF-generation library was already a dependency;
  see "Phase 4" above.
- Product review by the product's own seller isn't blocked — a low-priority
  edge case, not a security issue (their review still needs their own purchase
  to be "verified," which they get for free as the owner, so it'd read oddly
  but isn't exploitable for anything).
- Analysis/Community/Guides/Tutorials/Developer-Resources are still stub
  ("coming soon") pages — News and Signals became real in Phase 3.
- The `/admin`, `/seller`, `/dashboard` redirect-to-sign-in for an
  authenticated-but-unauthorized user is a UX nit (looks like "not logged in"
  when it's really "wrong role") — a dedicated 403 page would be a cheap fix.
- "Developer announcements" (a seller broadcasting an update to favoriters
  beyond the automatic price-change/new-version notifications) isn't built.
- Calendar/news sync (`runCalendarSync`/`runNewsSync`) has no in-process
  scheduler — see "Phase 3" above. Something external needs to enqueue these
  on a cadence (cron hitting `npm run sync:trigger`, or a platform scheduler).
  **Exception: the calendar** now keeps itself fresh via a page-view-triggered,
  DB-claimed sync (no Redis/cron) — see "Live calendar feed: Finance Calendar"
  above. News sync still needs an external trigger.
- `runMarketDataSync()` is a wired-but-empty stub — no `MarketPrice` schema
  exists yet. See its doc comment before building the Market Dashboard's
  price widgets against it.
- Calendar/event/article/signal timestamps display in UTC only, not the
  viewer's local timezone (see "Phase 3" above) — a known simplification,
  not an oversight.
- Product subscription renewal (`runSubscriptionRenewals`) has no
  in-process scheduler either — same external-cron model as calendar/news
  sync (see "Phase 4" above); `npm run subscriptions:renew` triggers one run.
- No error-monitoring *service* (Sentry or equivalent) is wired up — only
  structured logging (see "Phase 5" above and `docs/OBSERVABILITY.md` for
  the integration point). No CSP yet (see `docs/SECURITY.md`). One
  high-severity `npm audit` finding is a known, accepted risk (a
  `prisma` CLI devDependency, not the runtime client — see
  `.github/workflows/ci.yml`'s comment).
- Cursor (keyset) pagination isn't used anywhere — offset pagination
  throughout, fine at current scale; `docs/DATABASE.md` names the specific
  tables that would benefit most once they outgrow it.
- `listOutstandingSellerBalances()` and `listSellerCustomers()` are
  documented, deliberate scope limits from the Phase 5 audit (a
  correctness-required full-table scan for the former; a `distinct`-over-
  join query Prisma can't cleanly cursor-paginate for the latter, capped
  instead) — see `docs/PHASE5_AUDIT.md`.
- `SearchService.search()`'s news/signal branches use plain `ILIKE`, not
  true ranked full-text search (no tsvector column/trigger for those two
  tables yet, unlike products) — see "Phase 5" above. "Guides" and
  "developers" aren't search targets at all (no guides content model
  exists; no public seller-profile surface exists independent of a
  product).
- `src/lib/ai/`'s `AIProvider` has no real implementation — a `noop` stub
  throughout, matching the Stripe/M-Pesa pattern. Nothing calls it yet.
- The notification-service unification (`src/lib/notifications/notify.ts`)
  is new infrastructure, not adopted everywhere — most of the 14+
  pre-Phase-5 call sites that independently call `createNotification()` +
  `enqueueEmail()` still do so directly; migrate opportunistically, not in
  a batch (see "Phase 5" above for why).
- No deploy job exists in CI, and there's no staging/production
  environment separation — see `docs/DEPLOYMENT.md` for what exists today
  and what adding either would need.
- **Real target hosting now exists**: `fxbothub.com` is on a Hostinger
  shared hosting plan (confirmed via SSH — CloudLinux, no root/Docker, no
  local Postgres/Redis service). `docs/DEPLOY_HOSTINGER.md` covers the
  concrete setup (Node.js App + Git auto-deploy via hPanel, external
  Postgres/Redis) — a genuinely different shape from the Docker/VPS path
  `docs/DEPLOYMENT.md` otherwise documents, not a preference. **Known
  gap, deliberately scoped**: nothing runs the BullMQ workers
  (`npm run worker:*`) continuously on this plan, so calendar/news sync,
  email sending, event reminders, and subscription renewals are enqueued
  but never consumed once `REDIS_URL` is set — the web app itself
  (marketplace, auth, checkout, calendar reads, the hero chart) is
  unaffected. Two ways to close it, not yet decided/built: adapt the
  worker scripts to a "drain the queue and exit" mode triggerable by
  hPanel's cron (no `crontab` CLI access over SSH on this plan — use its
  web UI), or move those specific processes to a host that can run a
  persistent one (a small VPS, a serverless cron+queue service, etc.).
- `AuthorizedCalendarProvider` (calendar enhancement) has never made a
  request against a live Trading Economics account — this environment has
  no real `ECONOMIC_CALENDAR_API_KEY`. It's validated against the
  documented response shape, unit-tested with mocked data, and exercised
  end-to-end (insert/revision/dedup/cancellation/failure) against a real
  Postgres database with a mocked HTTP layer — see "Testing" above. Get a
  real key and re-verify before enabling it in production.
- `AuthorizedCalendarProvider.getHistoricalData()` is a best-effort
  client-side filter over a bounded 2-year window, not a confirmed
  provider-native historical-lookup endpoint (Trading Economics keys
  history by country/indicator, not currency/title the way this app's
  `CalendarProvider` interface asks for it) — see that method's own doc
  comment. Firm up once a real account confirms the actual endpoint shape.
- There is no in-process scheduler for `calendarSync` (same external-cron
  model as the rest of the sync jobs — see "Phase 3" above); "next sync" on
  `/admin/data-sources` is only an estimate based on
  `ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES`, not a guarantee. Use the new
  "Run calendar sync now" button for an immediate sync instead of waiting.
- The calendar's timezone picker (`/calendar`) persists via a cookie and,
  for signed-in users, `CalendarPreference.timezone` — but the page
  doesn't yet read a signed-in user's *other* saved preferences
  (currencies/impacts/categories) back on load either; the "save as
  default" action has always been write-only (see the `CalendarPreference`
  model comment). Timezone follows that same pre-existing pattern rather
  than fixing it — a broader fix is a separate, deliberate change.
- `CalendarUpdateEvent` (`src/services/calendar/realtime.ts`) is an inert
  type with no producer or transport — see the "Two-level refresh" note
  above. Wiring an actual SSE/WebSocket layer to it is future work, not
  started here, per the enhancement's own brief not to add that complexity
  until polling stops being sufficient.
- **`TwelveDataProvider` (homepage hero chart) has never made a request
  against a live Twelve Data account** — this environment has no real
  `MARKET_DATA_API_KEY`. Same situation and same caution as
  `AuthorizedCalendarProvider`: mapping is unit-tested against the
  documented shape and exercised end-to-end against a real Postgres with
  a mocked HTTP layer, not a live account. Before enabling it in
  production: get a real key, re-verify, and confirm the specific Twelve
  Data plan's license actually permits displaying/redistributing its data
  publicly on this site (see "Homepage hero" above and its brief's own
  licensing requirement).
- Hero chart drawing tools, technical indicators, watchlists, a market
  overview page, and per-instrument pages aren't built — the architecture
  (`MarketDataProvider`, `Instrument` model, `/api/market-data/*`) is
  designed so they can be added later without rewriting this, per the
  brief's own "future features, don't build yet" instruction.
- `npm run build` currently fails in any environment with no Redis
  running (confirmed pre-existing on the commit before the hero-chart
  work — not caused by it) — Turbopack's static-prerender step crashes
  on an unhandled Redis-unreachable rejection reachable from
  `/auth/forgot-password`, despite `src/lib/redis.ts`'s documented
  "fails fast and quietly" intent. CI always provisions Redis, so this
  hasn't surfaced there. Flagged as a separate follow-up task; until
  fixed, verify a production build against an environment with Redis
  running (`docker compose up` provides one).
