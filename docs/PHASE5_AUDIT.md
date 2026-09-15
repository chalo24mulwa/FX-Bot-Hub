# FX Bot Market — Phase 5 Scalability & Security Audit

Performed before any Phase 5 architectural change, per the phase brief. Findings
are cited by file:line and come from direct code inspection, not guesses. Each
finding below is marked with what Phase 5 actually did about it — **fixed**,
**mitigated**, or **deferred** (with reasoning) — see the corresponding commit
and `CLAUDE.md`'s "Phase 5" section for implementation detail.

## 1. Database

### Missing indexes (fixed — new migration)
- `Order`: no index beyond the `idempotencyKey` unique, despite
  `dashboard/orders/page.tsx` querying `userId`+`createdAt` and admin pages
  querying `status`+`createdAt`.
- `Product`: `status` is indexed combined with `type`/`featured`/`pricingType`,
  but not with `publishedAt`/`updatedAt`, the columns actually used for sort
  (`product-repository.ts`'s default marketplace sort, the moderation queue).
- `Notification`: indexed on `(userId, read)` but list pages sort by
  `createdAt`, not covered.
- `Invoice`: `buyerId`/`sellerId` indexed singly; both list views sort by
  `createdAt`.
- `AuditLog` / `SecurityEvent`: no plain `createdAt` index despite both being
  read via unfiltered `orderBy: { createdAt: "desc" }` admin lists.
- `Subscription`: no index at all beyond the compound unique; the renewal
  worker's `WHERE status = 'ACTIVE' AND currentPeriodEnd <= now()` runs every
  tick with no supporting index — gets worse as subscriptions accumulate.
- `User`: no index on `role`, despite the admin user list filtering by it.
- `License`: no index covering the `issuedAt` sort used by both the
  buyer-facing and admin license lists.

**Action taken**: added indexes for all of the above (see
`prisma/migrations/*_phase5_indexes_and_analytics`).

### N+1 / serial-write patterns
- `completePaidOrder()` (`checkout-service.ts`) does ~5 sequential awaited
  writes *per order item* (license/subscription upsert, cart-item delete, two
  ledger entries, one invoice) with **no transaction wrapping it** — a crash
  mid-loop could leave an order `PAID` with only some items licensed. This is
  a correctness gap, not just a performance one.
  **Action taken (fixed)**: wrapped the whole per-order-item loop in
  `db.$transaction()`, and batched the ledger entries and invoices into single
  `createMany` calls across all items instead of per-item inserts. License/
  Subscription upserts stay per-item (Prisma has no batch-upsert, and cart
  sizes are small) but now run inside the same transaction.
- `refund-service.ts`'s per-item reversal loop — same pattern, smaller blast
  radius (already inside a `$transaction`). **Left as-is** — already atomic;
  the per-item write count here is inherently small (refunds are rare
  relative to checkouts) and batching would add complexity for negligible gain.
- Fire-and-forget fan-out loops (favoriters on price change, alert
  subscribers) are the *correct* pattern already (unawaited, queue-backed) —
  not N+1 in the harmful sense, but see "unbounded queries" below.

### Unbounded queries
- `notify-favoriters.ts`: `favorite.findMany` with no `take` — a very popular
  product could spawn an unbounded number of concurrent notification writes.
  **Action taken (fixed)**: capped at 5,000 and batched notification creation
  into one `createMany` instead of N individual inserts.
- `listSellerCustomers()` / `listSellerReviews()`
  (`seller/analytics-service.ts`): pagination params exist but weren't applied
  to the underlying query — the *entire* result set was fetched and sliced in
  memory. **Action taken (fixed)**: added a `take` cap so memory use is
  bounded; true DB-level cursor pagination for `listSellerCustomers`
  (it uses `distinct` over a join, which doesn't cleanly support offset/cursor
  pagination in Prisma) is **deferred** — flagged in "Known follow-ups" as
  needing a materialized "seller customers" view if a seller's order volume
  gets large enough for this to matter.
- `listOutstandingSellerBalances()` (`ledger-repository.ts`): an unfiltered
  `groupBy` over the whole `ledger_entries` table. **Deferred, deliberately**
  — this is a financial balance calculation; filtering it to "recent" activity
  would produce an *incorrect* balance. The new `(sellerId, createdAt)` index
  makes the scan cheaper; a materialized per-seller balance (updated
  incrementally rather than recomputed) is the real fix if this becomes a
  bottleneck at scale, noted as a follow-up rather than done speculatively.

### Pagination strategy
Every list in the app uses offset (`skip`/`take`) pagination — no cursor
pagination exists anywhere. This is fine at current scale. The tables most
exposed to unbounded growth with no pruning/archival (`economic_events`,
`audit_logs`, `security_events`, `notifications`, `downloads`,
`ledger_entries`, `license_activations`) are the ones that would benefit most
from cursor (keyset) pagination once row counts reach the high hundreds of
thousands. **Deferred** — converting every admin list to cursor pagination
is a real, bounded-scope task but not one this pass had room for; documented
as a follow-up with the specific tables named, so it isn't a vague TODO.

## 2. Security

### Real vulnerabilities found and fixed
1. **No rate limiting on the credentials sign-in path** (`src/lib/auth.ts`'s
   `authorize()`) — an unlimited-attempt online brute-force/credential-stuffing
   surface. **Fixed**: `checkRateLimit()` now records every *failed* attempt
   (wrong password, unknown email, banned account), keyed by both the
   submitted email and the caller's IP. Recording only on failure — not on
   every attempt — is a deliberate correction from an earlier version of
   this fix: checking the limit *before* verifying the password meant every
   legitimate, correctly-authenticated sign-in also counted against the
   limit, which would have broken this app's own e2e suite (several specs
   share fixed-credential accounts across parallel test files, easily
   exceeding a low per-attempt threshold with entirely legitimate sign-ins)
   and penalizes real users for no reason. Caught by actually running the
   full e2e suite after the first version of this fix, not by inspection —
   see `docs/DEVELOPER_GUIDE.md`'s review checklist for why "did you run
   the tests" matters even for a change that looks obviously correct.
2. **The `manual` payment provider's webhook path performs zero signature
   verification** — if `PAYMENT_PROVIDER=manual` were ever left set in
   production, an unauthenticated POST to `/api/payments/webhook` with a
   guessed/leaked `providerReference` could flip a `Payment` to `SUCCEEDED`
   and trigger license/subscription issuance without payment. In practice
   this requires guessing a random UUID *and* a matching PENDING payment to
   exist (checkout with the manual provider already completes synchronously,
   so there's normally nothing pending to hit) — low likelihood, but a real,
   unauthenticated state-changing gap. **Fixed**: the webhook route now
   refuses to process anything when `PAYMENT_PROVIDER === "manual"` and
   `NODE_ENV === "production"`, with a loud `SecurityEvent` logged if it's
   ever hit that way — the manual provider was never meant to reach
   production regardless (see its own doc comment from Phase 2), this makes
   that a hard stop instead of a comment-only warning.

### Minor gaps (fixed)
- `POST /api/products/[id]/reviews` and `requestRefundAction` had no rate
  limiting (spam/abuse risk, not an auth bypass). **Fixed** — added
  `checkRateLimit()` to both.
- `dashboard/orders/[id]/page.tsx` (and ~20 other dashboard/seller pages)
  use a non-null assertion on `session` rather than their own redirect
  guard. **Checked, confirmed non-issue, no change made**: every one of
  these pages is nested under a layout (`dashboard/layout.tsx`,
  `seller/layout.tsx`) that already redirects unauthenticated visitors
  before any child page renders — the assertion is safe in practice and is
  this codebase's consistent convention across every such page, not a gap
  isolated to one file. Adding a redundant per-page guard to only one of
  the ~21 pages would have made the codebase *less* consistent for no
  security gain.

### Confirmed correct (no action needed)
Object-level authorization (orders/invoices/licenses/seller assets/refunds/
signals all scope every query by the requester's own id before returning or
mutating), CSRF coverage on every state-changing route except the
deliberately-exempt payment webhook and license APIs, the three-layer admin/
seller/dashboard access gate (edge middleware + layout + per-action
permission check), and upload validation (extension + MIME + size, all
three) were all independently verified and found correctly implemented — no
changes made to any of these.

## 3. Caching

Before Phase 5, `cacheWrap()` had exactly **one** call site in the whole app
(the homepage's top-8 category list). Read-heavy, low-churn, public data that
was NOT cached: featured/newest product lists, the marketplace ranking query
(the single most expensive read in the app — a 500-row candidate fetch plus
in-memory scoring, run on every marketplace page load), the calendar's
default view, the published news list, and signal-provider public profiles.

**Action taken**: added `cacheWrap()` to all of the above, each keyed to
include its actual filter/query signature (so, e.g., different marketplace
filter combinations don't collide in the cache) with a TTL matched to how
often the underlying data actually changes (60–180s for marketplace/homepage
reads, a few minutes for calendar/news, since those already lag behind
real-time via the sync workers). No explicit cache invalidation was added at
mutation sites — consistent with the one existing precedent (TTL-only) and
deliberate given no invalidation infrastructure existed before this pass;
adding invalidation calls at every one of a dozen+ mutation sites without a
tested pattern risks a missed call being *worse* than short-TTL staleness.
Confirmed (and re-confirmed after adding new cache calls): nothing
user-specific or private is ever cached — every new cache key is for public,
unauthenticated-readable data only.

**Found during regression testing, not the original audit**: `cacheWrap()`'s
own Redis lookup shared the app's single ioredis client's `commandTimeout`
(2000ms, tuned for BullMQ) — when Redis is unreachable, every cache check
could cost up to ~2s before falling through, and a page calling `cacheWrap()`
twice (the signal provider profile page's provider + stats lookups) could
add ~4s of latency, initially surfacing as what looked like a UI bug in an
e2e test (a client-side navigation whose destination took long enough to
render that the URL hadn't updated within a 5s assertion). **Fixed**:
`cacheWrap()`/`cacheInvalidate()` now race every Redis read and write
against an independent 250ms timeout, so a cache lookup can never
meaningfully stall a request regardless of the shared client's own timeout.
See `CLAUDE.md`'s "Phase 5" section for the full misdiagnosis-then-fix story
— worth reading before adding another `cacheWrap()` call site.

## 4. Background jobs

`emailQueue` and `eventReminderQueue` job adds had **no retry/backoff
options** — unlike the sync queues, a transient failure (SMTP hiccup, a
reminder job crashing) was silently unretried and permanently lost.
**Fixed**: both now use the same `SYNC_JOB_OPTIONS` (3 attempts, exponential
backoff) as the sync jobs, applied at the `Queue` definition itself (not just
at scattered call sites) so future `.add()` calls inherit it automatically.

Failure visibility across every worker was `console.error` only, with no
persistence and no admin-visible view. **Fixed**: added a lightweight
structured logger (`src/lib/logger.ts`) used by every worker and the payment
webhook, and a minimal **admin queue-health page** (`/admin/queues`) that
reads recent `SyncLog` rows (already existed for calendar/news sync — reused,
not duplicated) plus each queue's failed-job count via BullMQ's own API. A
full job-monitoring dashboard (Bull Board or similar) is **deferred** — noted
as a follow-up rather than half-built.

## 5. Search

The current `SearchService` interface (`searchProductIds(query, limit)`) is
product-only. **Action taken**: extended the interface to a generic,
entity-tagged shape (`search(query, {types, limit}) → {id, type, ...}[]`) so
news/signals/developers can be added as additional branches without another
interface change, and implemented the news/signal branches against Postgres
full-text search using the same `tsvector` pattern already proven for
products. A true autocomplete endpoint and typo-tolerant fuzzy ranking beyond
the existing `pg_trgm` fallback, and a "guides" content type (no guides
content model exists in this app), are **deferred** — see "Known follow-ups."

## 6. Frontend / observability

- One raw `<img>` tag exists (`product-assets-manager.tsx`, already
  lint-suppressed) — a seller-tool thumbnail, low traffic; **left as-is**,
  not worth the churn for a low-visibility internal tool.
- `next.config.ts`'s `images.remotePatterns` wildcards all hostnames (by
  design, since product images live in environment-specific S3/R2/MinIO).
  This is real looseness (a hostname allowlist would be tighter) but tying it
  to a fixed list would break across environments without more plumbing;
  **deferred**, flagged for whoever finalizes the production storage config
  to replace the wildcard with the actual deployed bucket's hostname.
- No structured logging or error-monitoring SDK existed anywhere.
  **Partially fixed**: added a minimal structured logger (see "Background
  jobs" above); wiring an actual error-monitoring service (Sentry or
  similar) needs an account/DSN this environment doesn't have — the
  integration point is documented in `docs/OBSERVABILITY.md` rather than
  stubbed with a fake provider.
- `/api/health` checked Postgres only. **Fixed** — now also checks Redis,
  reporting per-dependency status rather than a single boolean.
- CI (`ci.yml`) validates (install/migrate-check/lint/typecheck/test/e2e/
  build) but never deploys, and there's no security-scan step or
  staging/production environment separation. **Fixed**: added `npm audit
  --audit-level=critical` as a CI step. The threshold is `critical`, not
  `high`, because there is one pre-existing high-severity advisory today
  (`deepmerge-ts`, pulled in transitively by the `prisma` CLI
  devDependency only — `@prisma/client`, what actually ships to
  production, is unaffected) with no fix available that doesn't downgrade
  Prisma below this project's own pinned version (see CLAUDE.md's Prisma
  note). This is a known, accepted, explicitly-tracked risk — not hidden —
  and the threshold should move back to `high` once a real upstream fix
  lands; `npm audit fix --force` was deliberately NOT run since it would
  silently violate the Prisma version pin. Actual deployment automation
  and environment separation are **deferred** — there is no target hosting
  provider configured in this project yet, so a deploy job would be
  unverifiable dead code; `docs/DEPLOYMENT.md` documents the manual process
  and what a deploy job would need once a target exists.
- No explicit Prisma connection-pool tuning. **Deferred** — the right pool
  size depends on the deployment target's concurrency model
  (serverless vs. long-lived server), documented with concrete guidance in
  `docs/DEPLOYMENT.md` rather than guessed at.
