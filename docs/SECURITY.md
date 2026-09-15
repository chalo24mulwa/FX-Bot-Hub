# Security guide

This is the standing reference for this app's security posture — what's
protected and how, and what to check before shipping a new feature that
touches auth, money, or another user's data. `docs/PHASE5_AUDIT.md` is the
point-in-time audit that produced most of this; this document is the
living summary that should stay current as the app changes.

## Authentication

- Auth.js v5, Credentials (bcrypt) + optional Google OAuth
  (`src/lib/auth.ts`). JWT sessions (a Credentials provider forces this).
- **Rate limited** (Phase 5): the credentials sign-in path records every
  *failed* attempt (10/5min by email, 30/5min by IP) — before Phase 5 this
  had no limit at all, an online brute-force/credential-stuffing gap.
  Deliberately counts failures only, not every attempt: a successful,
  correctly-authenticated sign-in never counts against the limit, so a
  legitimate user (or a shared account signing in repeatedly and
  correctly, like this app's own e2e fixtures) is never penalized. A
  rate-limited response is denied the same way a wrong password is, so an
  attacker can't distinguish the two.
- A banned user (`User.bannedAt`) is rejected at `authorize()` for
  credentials, and at the `signIn()` callback for OAuth (covers an
  already-banned user signing in with Google).
- Session role/ban status re-syncs from the DB periodically (every 60s) or
  immediately on `updateSession()` — see `CLAUDE.md`'s RBAC section for
  why this exists (an admin changing a role/ban shouldn't require the
  affected user to sign out and back in to take effect).

## Authorization / RBAC

Three redundant layers, deliberately — don't remove any one of them:

1. **Edge**: `src/proxy.ts` gates `/admin`, `/seller`, `/dashboard` before
   any page renders.
2. **Layout**: every admin/seller/dashboard layout re-checks `auth()`
   server-side.
3. **Action/route**: every Server Action and API route that mutates data
   calls `requirePermission()` (`src/lib/authorization/guard.ts`) for the
   *specific* capability it needs — never just "is logged in."

Capabilities are centralized in `src/lib/authorization/permissions.ts`'s
`can()` matrix — never write `role === "ADMIN"` inline in a page or route;
add a new capability to that matrix instead.

## Object-level authorization (IDOR)

Every route/action that reads or mutates a specific resource (an order, a
license, an invoice, a refund, a seller's own product/assets, a
subscription) verifies the resource actually belongs to the requesting
user (or that the requester is staff/the resource's seller) **before**
returning or changing anything — never inferred from the client, always
re-checked server-side per request. Verified for every such surface as of
the Phase 5 audit (`docs/PHASE5_AUDIT.md` §2) — no gap found. When adding
a new "user's own X" surface, follow the existing pattern: fetch by id,
compare ownership, only then act — see
`src/features/refunds/actions.ts`'s `requestRefundAction` for a
representative example.

## CSRF

- Server Actions get Next.js's built-in same-origin protection for free.
- Hand-written `/api` routes that mutate data call `assertSameOrigin()`
  (`src/lib/security/csrf.ts`) explicitly — it is **not** automatic for
  API routes.
- Three deliberate exceptions, none of which are browser callers:
  `/api/payments/webhook` (provider-signed), `/api/licenses/verify`,
  `/api/licenses/activate`, `/api/licenses/deactivate` (the license key
  itself is the credential — see `docs/API.md`).

## Rate limiting

`checkRateLimit()` (`src/lib/security/rate-limit.ts`) — a Redis
fixed-window counter, **fails open** if Redis is unreachable (defense in
depth must not itself become an outage risk). Applied to: sign-in
(email+IP), registration, checkout, license verify/activate/deactivate,
contact-seller, review creation, refund requests, favorite toggling, and
search. `RATE_LIMIT_DISABLED=true` bypasses this entirely — **never** set
it in production; it exists for test/CI environments without Redis.

## Webhook security

`/api/payments/webhook` trusts only `PaymentProvider.parseWebhook()`'s
signature verification (per-provider — see each provider file's doc
comment for what a real implementation must check). An invalid signature
is logged as a `SecurityEvent` and rejected with `400`, never processed as
a real payment event. The `manual` provider performs no signature check at
all (nothing to verify — it's a dev/staging-only synchronous stub) and is
**hard-refused in production** (`NODE_ENV=production` +
`PAYMENT_PROVIDER=manual` returns `503`) — a Phase 5 fix; see
`docs/PHASE5_AUDIT.md` for the exploitability reasoning.

## File uploads / downloads

- Uploads never touch the server's memory or disk — sellers get a
  presigned PUT URL (`/api/seller/uploads/presign`) and upload directly to
  object storage. `validateUpload()` checks extension, MIME type, *and*
  size (all three, not just one) before a presigned URL is ever issued.
- Downloads (`/api/downloads/[productFileId]`) re-verify entitlement on
  **every** request (never a cached/previously-rendered "you own this"
  state) and redirect to a 120-second signed URL — never a raw, permanent
  storage URL.

## Fraud / abuse signals (never auto-acting)

`SecurityEvent` (`/admin/security`) logs: repeated payment failures,
suspicious download volume, invalid webhook signatures, license-activation
abuse, and (Phase 5) review-abuse patterns. **Nothing reads a
`SecurityEvent` and automatically bans, suspends, or revokes anything** —
these are signals for an admin to review, per the explicit instruction not
to auto-ban on simplistic rules. If you're tempted to wire one up to an
automatic action, that's a deliberate, separate product decision — not
something to add casually alongside a new detection rule.

## Secrets / environment

- All server secrets are parsed through `src/lib/env.ts` (Zod) — fails
  fast on boot if a required one is missing.
- `NEXT_PUBLIC_*` variables ship to every visitor's browser — never put a
  secret in one. `src/lib/storage/public-url.ts` deliberately avoids
  importing `env.ts` (which would pull every server secret into a file
  that must also load client-side) and reads only its one
  `NEXT_PUBLIC_` variable directly — follow that pattern for any other
  public-safe config value.
- `.env.example` contains only placeholders — never real secrets. Checked
  as of the Phase 5 audit; keep it that way.
- No secrets found logged anywhere in the codebase as of the Phase 5
  audit — don't `console.log` a full request/config object that might
  contain one.

## Security headers

`next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy`, `Permissions-Policy`, and
`Strict-Transport-Security`. **No Content-Security-Policy yet** —
deliberately deferred until an inline-script/style audit is done; shipping
a CSP that's either broken (blocks the app) or too permissive (`unsafe-inline`
everywhere, providing no real protection) is worse than not having one.
Do this audit before launch if XSS defense-in-depth matters for your
threat model.

## Known, accepted risks (not gaps — tracked deliberately)

- `images.remotePatterns` in `next.config.ts` wildcards all hostnames,
  since product images live in environment-specific object storage with a
  hostname that varies by deployment. Tighten to your actual deployed
  bucket's hostname once you have one fixed target.
- One high-severity `npm audit` finding (`deepmerge-ts`, via the `prisma`
  CLI devDependency only — not the runtime `@prisma/client`) has no fix
  available without downgrading Prisma against this project's own version
  pin. See `docs/PHASE5_AUDIT.md` and `.github/workflows/ci.yml`'s comment
  on the `npm audit` step.

## Before shipping a feature that touches auth, money, or another user's data

- [ ] Does every route/action that reads or mutates it check ownership,
      not just "is logged in"?
- [ ] Does every mutating `/api` route call `assertSameOrigin()` (unless
      it's a deliberate non-browser-caller exception, documented as such)?
- [ ] Does it need rate limiting? (Anything that costs money, sends email,
      or could be abused for spam/enumeration probably does.)
- [ ] If it's a payment-adjacent change: does anything trust a client-
      reported "success" state instead of a verified server-side/webhook
      confirmation? (See the PRODUCTION REQUIREMENT note in `CLAUDE.md`.)
- [ ] If it writes financial data: is it inside a `$transaction` where
      partial failure would otherwise leave inconsistent state (e.g. an
      order marked paid with only some items licensed)?
