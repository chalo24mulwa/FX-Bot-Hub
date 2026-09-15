# API reference

Most of the app's mutations go through Next.js **Server Actions**
(`src/features/*/actions.ts`), used directly from Client Components — those
aren't REST endpoints and aren't listed here (see `CLAUDE.md`'s "Service
layout" section for that pattern). This document covers the actual `/api`
HTTP surface: what exists today, and the conventions every route follows so
a future mobile app (or any external client) can rely on them without
reading source.

## Conventions

- **Auth**: session-authenticated routes read the Auth.js session cookie
  (same as the web app — there's no separate API token/key scheme yet).
  Unauthenticated requests to a protected route get `401`. The license
  verification/activation routes and the payment webhook are the
  deliberate exceptions — see their entries below for why.
- **Authorization**: every mutating route checks the specific capability it
  needs via `requirePermission()` (`src/lib/authorization/guard.ts`), not
  just "is logged in" — see `CLAUDE.md`'s RBAC section.
- **CSRF**: every mutating route call `assertSameOrigin()` except the
  payment webhook and the three license routes (non-browser callers by
  design — see their entries).
- **Rate limiting**: listed per route below; all fail open if Redis is
  unreachable (defense-in-depth, not a hard dependency — see
  `docs/OBSERVABILITY.md`).
- **Validation**: request bodies/query params are parsed with Zod; a
  validation failure returns `400` with the Zod error detail.
- **Pagination**: list endpoints that paginate return `{ items, total,
  page, pageSize }`. Search (`/api/search`) is the exception — it returns
  tagged results across multiple entity types, not one paginated list; see
  its own entry.
- **Errors**: `{ "error": "message" }` with an appropriate HTTP status
  (`400` validation, `401` unauthenticated, `403` unauthorized, `404` not
  found, `409` conflict, `429` rate-limited, `503` dependency unavailable).

## Auth — `/api/auth`

- `GET/POST /api/auth/[...nextauth]` — Auth.js's own handler (sign-in,
  sign-out, session, OAuth callbacks, CSRF token). Not hand-written; see
  `src/lib/auth.ts` for provider configuration.
- `POST /api/auth/register` — create a credentials account. Rate-limited
  (5/15min). As of Phase 5, sign-in itself (`authorize()` in
  `src/lib/auth.ts`) is also rate-limited, by both email and IP.

## Products — `/api/products`

- `GET /api/products` — public, paginated/filterable product listing
  (`ListProductsQuery`: type, platform, pricingType, category, price
  range, rating, search `q`, sort, page/pageSize).
- `POST /api/products` — create a draft product. Requires `product:create`
  (seller role).
- `GET /api/products/slug/[slug]` — public, single published product by
  slug.
- `POST /api/products/[id]/reviews` — submit/update a review for a
  product. Rate-limited (10/hour per user, Phase 5). Verified-purchase
  status is derived server-side, never client-supplied.
- `POST /api/products/[id]/contact-seller` — message a product's seller.
  Rate-limited (10/hour).

## Categories

No dedicated `/api/categories` route exists — categories are read via
Server Components directly (`db.productCategory.findMany`) and managed via
admin Server Actions. Add a route here if an external client needs them
before a Server Component/Action can serve that need.

## Sellers

No dedicated `/api/sellers` route exists yet — public seller data is only
exposed as part of a product's `seller`/`sellerProfile` relation today.
Add one if a future client needs a seller's public profile independent of
a specific product.

## Cart & checkout — `/api/cart`, `/api/checkout`

- `GET /api/cart` — the current user's cart.
- `POST /api/cart` — add a product.
- `DELETE /api/cart` — remove a product.
- `POST /api/checkout` — charge the cart via `PaymentService` and, on
  synchronous success, mark the order paid. **Send an `Idempotency-Key`
  header** — a retried request with the same key returns the existing
  order instead of creating a duplicate one (see `CLAUDE.md`'s Phase 4
  section). Rate-limited (10/min).

## Licenses — `/api/licenses`

- `POST /api/licenses/verify` — given a license key, returns validity/
  status/activation counts. **No session required** — the license key
  itself is the credential (the same shape as any commercial license
  check an EA would perform), so this is an intentional exception to the
  "session-authenticated" convention above. Rate-limited by IP (60/min).
- `POST /api/licenses/activate` / `deactivate` — bind/release a license to
  a machine fingerprint. Same no-session pattern. Rate-limited (20/min
  each).

Enforcement, activation-limit logic, and what these routes do and don't
protect against (not real DRM) are documented in
`src/features/licenses/license-service.ts` and `CLAUDE.md`.

## Downloads — `/api/downloads/[productFileId]`

- `GET` — re-verifies entitlement on every call (never trust a
  previously-rendered "you own this" state) and redirects to a 120-second
  signed URL. Never returns a raw storage URL.

## Reviews

See `/api/products/[id]/reviews` above — reviews are scoped under their
product, not a top-level `/api/reviews` collection.

## Signals — `/api/signals`

No dedicated REST routes exist — signal creation/subscription/moderation
all go through Server Actions (`src/features/signals/actions.ts`). Public
signal reads are Server Components. Add REST routes here if/when a mobile
client needs them (see "Mobile app readiness" below).

## Calendar — `/api/calendar`

- `GET /api/calendar` — public, filterable by `currency`/`from`/`to`,
  capped at 200 rows. Note: the full-featured calendar UI
  (`src/services/calendar/calendar-service.ts`'s `getEvents()`, with
  impact/category/country filters and real pagination) is richer than
  this route and is what the web app's own `/calendar` page actually
  uses — this route is a simpler public read, not yet upgraded to match.

## News

No dedicated `/api/news` route exists — the `/news` pages are Server
Components reading `src/features/news/news-service.ts` directly. Add a
route here if an external client needs it.

## Notifications

No dedicated `/api/notifications` route exists — `/dashboard/notifications`
is a Server Component, and marking one read is a Server Action
(`markNotificationRead`). Add a route here if an external client needs it.

## Search — `/api/search`

- `GET /api/search?q=...&types=product,news,signal&limit=20` — Phase 5.
  Public, rate-limited by IP (60/min). Returns `{ query, results }` where
  each result is tagged `{ id, type, title, subtitle?, url }` across
  products/news/signals (no session required — a public search box).
  "guides" and "developers" are not yet search targets — see
  `src/lib/search/types.ts`'s doc comment for why. Backed by
  `SearchService` (`src/lib/search/`), swappable for an OpenSearch/
  Elasticsearch implementation later without changing this route.

## Analytics

No dedicated `/api/analytics` route exists — tracked events
(`src/lib/analytics/track.ts`) are written directly from Server Components
on view, and the admin/seller analytics dashboards read aggregates via
Server Components too. Add a route here if a future client needs to submit
events itself (e.g. a mobile app tracking its own screen views) or read
aggregates externally.

## Payments — `/api/payments/webhook`

- `POST /api/payments/webhook` — the one endpoint every payment provider
  posts to. **No session, no CSRF check** — a payment provider isn't a
  signed-in browser and won't send an `Origin` header a same-site check
  would accept; trust comes from `PaymentProvider.parseWebhook()`
  verifying the payload's signature instead (see `CLAUDE.md`'s Phase 4
  section). Hard-refuses (`503`) if `PAYMENT_PROVIDER=manual` in
  production (Phase 5 security fix — see `docs/PHASE5_AUDIT.md`).

## Health — `/api/health`

- `GET` — checks Postgres (hard dependency, drives the `200`/`503`) and
  Redis (soft dependency, reported as `"degraded"` if down, doesn't flip
  the status code) separately. See `docs/OBSERVABILITY.md`.

## Mobile app readiness

Per the Phase 5 brief: the goal isn't to build a mobile app now, but to
make sure the backend *can* support one without rewriting business logic.
Where this stands:

- **Ready today**: auth (session cookie — a mobile client would need
  Auth.js's credentials flow or a token-based adaptation), products,
  checkout, licenses, downloads, calendar, search.
- **Server Actions, not REST, today**: signals, news, notifications,
  categories, sellers — a mobile client can't call a Server Action
  directly. The business logic these call (`src/features/*/`) is already
  separated from the Server Action wrapper, so adding a thin `/api` route
  per one (mirroring the `/api/products` pattern: parse input, call the
  same service function, return JSON) is additive work, not a rewrite —
  see `CLAUDE.md`'s "Service layout" section for why that separation
  exists.
- **Not yet designed**: token-based auth for a native client (session
  cookies don't work the same way outside a browser) — a mobile app would
  need either a dedicated token/refresh-token flow or Auth.js's own mobile
  guidance, whichever is chosen when that work actually starts.
