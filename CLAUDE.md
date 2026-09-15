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
  calendar+news+market-data sync pass and exits; `npm run subscriptions:renew`
  enqueues one product-subscription renewal pass and exits — both for wiring
  to an external cron (renewal wants a daily cadence, sync can run more often).
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
  and what adding either would need. Not fabricated here since there's no
  real target hosting provider configured in this project.
