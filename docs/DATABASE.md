# Database

PostgreSQL via Prisma (`prisma/schema.prisma` is the single source of truth
for structure — this document explains how the schema is organized and
operated, not a field-by-field mirror of it, since that would drift out of
sync immediately). Prisma is pinned to **6.19.3**, not `latest` — see the
note at the top of `CLAUDE.md` for why (Prisma 7+ changed the config model).

## Domain areas

The schema is organized into commented sections, in this order:

1. **Auth.js** — `User`, `Account`, `Session`, `VerificationToken`, `Profile`.
2. **Seller / marketplace catalog** — `SellerProfile`, `ProductCategory`, `Product` and its child tables (`ProductVersion`, `ProductFile`, `ProductImage`, `ProductScreenshot`, `ProductDocumentation`), `Review`, `ProductRating`, `ProductRatingSummary` (materialized aggregate), `Favorite`, `Download`.
3. **Cart / orders / payments / licensing / subscriptions** — `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `License`, `LicenseActivation`, `Subscription`.
4. **Commerce (Phase 4)** — `ProcessedWebhookEvent`, `Refund`, `Invoice`, `LedgerEntry`, `Payout`, `SecurityEvent`.
5. **Notifications / audit** — `Notification`, `AuditLog`.
6. **Phase 5 analytics** — `AnalyticsEvent`.
7. **Economic calendar** — `EconomicEvent`, `CalendarPreference`.
8. **Forex news** — `NewsCategory`, `NewsArticle`.
9. **Forex signals** — `SignalProviderProfile`, `Signal`, `SignalSubscription`.
10. **Alerts** — `Alert` (polymorphic — see its model comment for why `targetId` is a required, non-FK string).
11. **Data sync infrastructure** — `DataSource`, `SyncLog`.
12. **Marketplace settings** — `MarketplaceSettings` (singleton row).

## Migrations

Applied in `prisma/migrations/`, one directory per change, named
chronologically. This project's environment can't run `prisma migrate dev`
interactively, so every migration in this repo's history was generated with
the manual three-step workflow — reproduce it the same way for a new change:

```bash
# 1. Generate the SQL diff between the live DB and the current schema.prisma
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > /tmp/migration.sql

# 2. Create the migration directory and apply the SQL directly
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_your_change_name
cp /tmp/migration.sql prisma/migrations/<the-directory-above>/migration.sql
npx prisma db execute --file prisma/migrations/<the-directory-above>/migration.sql --schema prisma/schema.prisma

# 3. Tell Prisma's migration history this one is already applied, then regenerate the client
npx prisma migrate resolve --applied <the-directory-name>
npx prisma generate
```

In a normal (non-sandboxed) environment, `npx prisma migrate dev --name
your_change_name` does all of this in one step — prefer that when it's
available to you. In CI/production, `npx prisma migrate deploy` applies any
pending migrations non-interactively (already wired into `.github/
workflows/ci.yml`).

## Indexing strategy

Every index in the schema exists because a real query needs it — see each
`@@index`'s inline comment for which query. Phase 5's
`docs/PHASE5_AUDIT.md` documents the specific audit that added most of the
current composite indexes (`Order`, `Product`, `Notification`, `Invoice`,
`AuditLog`, `SecurityEvent`, `Subscription`, `User`, `License`) — **don't
add a new index speculatively**; add one when a specific query's `WHERE`/
`ORDER BY` shape needs it, and note which query in the migration/comment,
matching that precedent.

## Pagination

Every list endpoint uses offset (`skip`/`take`) pagination — no cursor
pagination exists anywhere yet. This is fine at this app's current scale.
The tables most exposed to unbounded growth with no pruning/archival
(`economic_events`, `audit_logs`, `security_events`, `notifications`,
`downloads`, `ledger_entries`, `license_activations`, `analytics_events`)
are the ones that would benefit most from cursor (keyset, `createdAt` +
`id`) pagination once row counts reach the high hundreds of thousands —
see `docs/PHASE5_AUDIT.md`'s database section for the specific reasoning.

## Materialized vs. computed-on-read aggregates

`ProductRatingSummary` is a materialized aggregate (recomputed by the
review service on write, read directly rather than aggregated on every
request) — the deliberate exception to this app's general "compute on
read" default (used by, e.g., `computeProviderStats` for signal providers).
Reach for computed-on-read first; only materialize when a specific read
path is proven hot enough to need it, the same judgment call already made
for ratings vs. everything else.

## Connection pooling in production

`src/lib/db.ts` uses the standard Next.js singleton `PrismaClient` pattern
(one client per process, reused across dev hot-reloads) but does **not**
set explicit connection-pool parameters — the right values depend on your
deployment target's concurrency model:

- **Long-lived server process** (a container, a traditional VM): Prisma's
  default pool (`num_physical_cpus * 2 + 1` connections) is usually fine.
  If you run multiple replicas, make sure `replicas × pool_size` stays
  under your Postgres instance's `max_connections`.
- **Serverless / edge** (Vercel functions, AWS Lambda): each cold-started
  instance opens its own pool, which can exhaust Postgres's connection
  limit under concurrent traffic. Put a connection pooler in front of
  Postgres (PgBouncer, or a managed equivalent like Supabase's/Neon's
  built-in pooler) and point `DATABASE_URL` at the pooler, not the
  database directly; add `?pgbouncer=true&connection_limit=1` to the
  connection string per Prisma's serverless guidance.

This project doesn't assume a specific deployment target, so it doesn't
hard-code pool parameters — set them via `DATABASE_URL`'s own query-string
options for whichever target you actually deploy to.

## Backups

See `docs/BACKUP.md` — database backups are **not** assumed to exist just
because a managed Postgres provider advertises them; that document is
explicit about what to actually verify.
