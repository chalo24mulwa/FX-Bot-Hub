# Observability

## Structured logging

`src/lib/logger.ts` (Phase 5) — every log line is one JSON object
(`{level, message, time, ...context}`) instead of an ad hoc string, so
piping stdout into any log aggregator (CloudWatch, Datadog, a self-hosted
Loki stack, etc.) already works without a parser. Used by every BullMQ
worker and the payment webhook route today; other routes still use plain
`console.log`/`console.error` — migrate them to `logger` opportunistically
when you're already touching that file, the same "don't mass-refactor
working code" judgment call documented in `docs/PHASE5_AUDIT.md` for the
notification service.

This is **not** an error-monitoring *service* (Sentry, Rollbar, etc.) — it
only gives every log line a consistent shape. Wiring in a real one:

1. Pick a provider, get a DSN/API key, add it to `docs/ENVIRONMENT.md` and
   `.env.example`.
2. Most providers ship a Next.js SDK with an instrumentation hook
   (`instrumentation.ts` at the project root, or a wrapped `next.config.ts`)
   that captures unhandled errors automatically — follow that provider's
   own Next.js setup guide.
3. For BullMQ worker failures specifically, call the provider's capture
   function from each worker's `.on("failed", ...)` handler (currently
   just `logger.error(...)` — add the provider call alongside it, not
   instead of it).

No provider is wired in today because this environment has no real
account/DSN to configure — stubbing one in with a fake key would be
worse than not having it, since it'd look configured without actually
reporting anything.

## Health checks

`GET /api/health` (see `docs/API.md`) checks Postgres (hard dependency —
drives the HTTP status) and Redis (soft dependency — reported separately,
doesn't flip the status) independently, matching this app's actual
fail-open design for Redis-backed features (caching, rate limiting,
queues — see `src/lib/redis.ts`, `src/lib/cache.ts`,
`src/lib/security/rate-limit.ts`). Point your platform's health-check probe
(load balancer, container orchestrator) at this route.

## Queue / background-job monitoring

`/admin/queues` (Phase 5) — per-queue job counts (waiting/active/delayed/
completed/failed) via BullMQ's own `getJobCounts()`, plus the last 30 sync
runs from `SyncLog` (already existed for calendar/news sync, reused here
rather than duplicated). This is deliberately minimal — a job's failure
reason isn't browsable from this page, only its count. For a real job
browser with retry/inspect-payload capability, add a
[Bull Board](https://github.com/felixmohr/bull-board) (or equivalent)
integration — not built here; flagged as a known follow-up in
`docs/PHASE5_AUDIT.md`.

Every queue's `defaultJobOptions` (`src/lib/queue/queues.ts`) is 3 attempts
with exponential backoff — a transient failure retries automatically
before it needs a human. A job still visibly `failed` after 3 attempts is
worth investigating via `/admin/queues` and the worker's own log output.

## Performance monitoring

No APM (Application Performance Monitoring — request tracing, slow-query
detection at the application layer) is wired in. For Postgres specifically:

- `EXPLAIN ANALYZE` any query you suspect is slow — Prisma's generated SQL
  is visible via `DATABASE_URL`'s `?connection_limit=...` companion,
  `prisma:query` debug logging (`DEBUG="prisma:query" npm run dev`), or
  your Postgres provider's own slow-query log.
- Most managed Postgres providers (RDS, Supabase, Neon, etc.) expose
  connection count, cache hit ratio, and slow-query logs in their own
  dashboards — enable those rather than re-building equivalent tooling
  here.

## What "critical dependencies" means for this app

If you're setting up alerting, these are the things worth paging on:

- **Postgres unreachable** — the whole app is down (every page reads from
  it). `/api/health` returns `503`.
- **Redis unreachable** — the app stays up but degrades: no caching (every
  cached read falls through to a direct DB query, which is slower but
  correct), no rate limiting (fails open — a real availability/abuse risk
  worth knowing about even though it isn't a hard outage), and every
  BullMQ-backed feature (email, calendar/news sync, event reminders,
  subscription renewal) stops processing until Redis comes back — jobs
  queue up and drain once it does, they aren't lost. `/api/health` reports
  this as `"degraded"`, not `"error"`.
- **Object storage (S3/R2/MinIO) unreachable** — product uploads and
  downloads fail; not currently checked by `/api/health` (add it there if
  you want that surfaced the same way).
- **Email provider unreachable** — enqueued emails retry (3 attempts,
  exponential backoff) via the email queue; a sustained outage means
  emails pile up in the queue rather than being lost, visible at
  `/admin/queues`.
