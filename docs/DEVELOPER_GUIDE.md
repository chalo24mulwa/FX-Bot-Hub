# Developer guide

Practical "how do I..." reference for working on this codebase. For *why*
things are built the way they are, see `CLAUDE.md` (the detailed,
phase-by-phase build log with the reasoning behind non-obvious decisions)
and `docs/ARCHITECTURE.md` (the higher-level map). Read `CLAUDE.md`'s
ground rule before making a structural change: **extend the existing
architecture, don't rebuild it.**

## Getting started

```bash
cp .env.example .env
docker compose up -d db redis minio
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

See `README.md` for seeded demo logins. See `docs/ENVIRONMENT.md` for what
every variable does.

## Day-to-day commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm run test` (Vitest — pure logic only, no DB; watch mode: `npm run test:watch`) |
| E2E tests | `npm run test:e2e` (Playwright — **always against a production build**, see below) |
| Production build | `npm run build` |
| New migration | See `docs/DATABASE.md`'s migration workflow |
| Prisma Studio | `npm run db:studio` |
| Re-seed demo data | `npm run db:seed` (idempotent — safe to re-run) |

## Adding a feature

1. **Schema change?** Follow `docs/DATABASE.md`'s migration workflow.
   Add an index only when a specific query needs it (name the query in
   the `@@index`'s comment) — see `docs/PHASE5_AUDIT.md` for the standard
   this repo holds itself to.
2. **New external integration** (a payment processor, a data feed, an AI
   provider, etc.)? Follow the provider-adapter pattern — see
   `docs/ARCHITECTURE.md`'s table of existing ones. Add an interface, a
   working default (or an honest "not configured" stub if there's no
   working default yet), and a registry entry. Never scatter
   provider-specific code across call sites.
3. **Business logic**: put it in `src/features/<domain>/`, not directly in
   a page or route component. Server Actions for anything triggered from a
   Client Component; `/api` routes only for external-client-facing
   surfaces (see `docs/API.md`).
4. **List/query logic**: check `src/repositories/` first — there's often
   already a reusable `where`-builder for the model you're touching
   (`buildProductWhere` is the canonical example). Extend it rather than
   hand-rolling a parallel filter.
5. **Authorization**: add a new capability to
   `src/lib/authorization/permissions.ts`'s matrix rather than an inline
   role check. Every mutating action/route calls `requirePermission()` (or
   `requireSession()` + an explicit ownership check for "user's own X").
6. **Notifications**: for a new event type, use `src/lib/notifications/
   notify.ts` (the unified helper) — existing call sites predating it
   weren't mass-migrated (see its doc comment for why), but new ones
   should use it.
7. **Caching**: only for public, non-user-specific, read-heavy data — see
   `docs/PHASE5_AUDIT.md`'s caching section for the exact reasoning and the
   Date-serialization gotcha below.

## The cache Date-serialization gotcha

`cacheWrap()` (`src/lib/cache.ts`) round-trips its return value through
`JSON.stringify`/`JSON.parse`. **`Date` fields become strings on a cache
hit, but stay real `Date` objects on a cache miss.** Before wrapping a new
read in `cacheWrap()`:

1. Check every downstream consumer of the cached data — does any of it
   call a `Date`-only method (`.toISOString()`, `.getTime()`, etc.)
   directly on a field from this data, with no `Date | string` tolerance?
2. If yes, either make the consumer tolerant (see `ProductCardData`'s
   `updatedAt: Date | string` + `new Date(product.updatedAt)` pattern in
   `src/components/marketplace/product-card.tsx`), or revive the Date
   fields after the cache read (see `reviveEventDates()` in
   `src/services/calendar/calendar-service.ts` for the pattern — `new
   Date(x)` is safe whether `x` is already a `Date` or a string).
3. If you skip this check, the bug is silent until a cache *hit* — an
   empty-state page or a first-load-only manual test won't catch it. This
   is the same class of bug as the Phase 3 `SignalCard` "use client"
   incident documented in `CLAUDE.md` — a crash that only appears once
   real data flows through a code path your testing didn't exercise.

## Testing conventions

- **Unit tests** (Vitest, colocated `*.test.ts`): pure logic only, no
  database, no mocking Prisma. If a function needs a DB, it's not a unit
  test candidate as-is — factor the pure math/logic out first (see
  `src/lib/ranking/score.ts` vs. `ranking-service.ts` for the pattern:
  the scoring math is pure and tested; the DB query around it isn't).
- **E2E tests** (Playwright, `e2e/*.spec.ts`): always run against a real
  production build (`playwright.config.ts`'s `webServer` runs `npm run
  build && npm run start`, not `next dev`) — this has caught real
  production-only bugs before (see `CLAUDE.md`'s `trustHost` note). If an
  e2e failure doesn't reproduce in `npm run dev`, that gap is often why —
  don't assume it's test flakiness.
- `e2e/global-setup.ts` seeds fixed-credential test accounts and fixture
  data **idempotently** (upserts, not creates) — safe to leave in the
  database across runs. Add new fixtures there, not to `prisma/seed.ts`
  (that's for local-dev demo data, a separate concern).
- `page.request` (Playwright's raw HTTP client) does **not** behave like
  an in-page `fetch()` call — see `CLAUDE.md`'s testing notes for the
  specific `Origin`-header and race-condition gotchas this has already
  caught.

## Common review checklist

Before opening a PR (or asking someone to review one):

- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] If you touched a `/api` route: does it need
      `assertSameOrigin()`/`requirePermission()`/rate limiting? (See
      `docs/SECURITY.md`'s checklist.)
- [ ] If you touched a page/query that could return a lot of rows: is
      there a `take` limit? (See `docs/PHASE5_AUDIT.md`'s "unbounded
      queries" findings for what this has already caught.)
- [ ] If you added a `cacheWrap()` call: did you check the Date gotcha
      above?
- [ ] If you touched financial logic (checkout, refunds, payouts,
      ledger): is the multi-write sequence inside a `$transaction`?
- [ ] Did you run `npm run build` at least once locally if you touched
      anything that could be a Server/Client Component boundary issue
      (an empty-state page hides these — see the cache gotcha above for
      why "it rendered in dev" isn't sufficient proof)?
