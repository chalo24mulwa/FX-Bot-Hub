# Backups & disaster recovery

**Do not assume backups exist just because your database provider
advertises them.** Most managed Postgres providers enable automated
backups by default, but retention windows, point-in-time-recovery
availability, and whether backups are tested are all provider- and
plan-specific — verify the specifics for whatever you actually deploy to,
and don't treat "the provider probably backs this up" as a substitute for
checking.

## What needs backing up

1. **PostgreSQL database** — the system of record for everything: users,
   products, orders, payments, licenses, the financial ledger, calendar/
   news/signal content, analytics events. Losing this without a backup is
   unrecoverable.
2. **Object storage (S3/R2/MinIO)** — product files, images, screenshots,
   documentation attachments. Losing this loses sellers' actual product
   deliverables, not just metadata about them.
3. **Environment/secrets** — `AUTH_SECRET`, database/storage/payment
   credentials. Not a "backup" in the data sense, but losing access to
   these without a recovery path means losing access to everything they
   protect. See "Secret management" below.
4. **Redis** — deliberately **not** a backup target. Everything in it
   (cache entries, rate-limit counters, queued jobs) is either
   regenerable or, for in-flight jobs, acceptable to lose in a true
   disaster (a lost queued email/sync job can be re-triggered manually —
   see `docs/API.md`'s job-trigger scripts). Don't spend backup budget
   here.

## Database backups

Minimum viable setup, regardless of provider:

- **Automated daily snapshots**, retained at least 7 days (30 if your
  compliance/business needs demand it).
- **Point-in-time recovery (PITR)** if your provider supports it — lets
  you restore to a specific minute rather than only the last daily
  snapshot, which matters a lot for a financial ledger table
  (`LedgerEntry`) where losing even a few hours of transactions is
  expensive to reconstruct.
- **Off-provider copy**: if your Postgres and your backups live with the
  same provider, a provider-wide incident can take out both. Periodically
  export a `pg_dump` to a separate object-storage bucket (a different
  provider, or at least a different region/account) — a cron job running
  `pg_dump $DATABASE_URL | gzip > backup-$(date +%F).sql.gz` piped to your
  storage of choice is sufficient; this doesn't need to be fancy.

**Verify, don't assume**: whichever of the above your actual provider
gives you by default, confirm it (their dashboard/docs) rather than
assuming — plans differ, and "backups" without PITR only protects against
some failure modes.

## Object storage backups

- Enable **versioning** on the bucket if your provider supports it (S3,
  R2, and most S3-compatible services do) — protects against accidental
  overwrite/delete, not just total loss.
- Enable **cross-region or cross-account replication** if your provider
  supports it, for the same "don't let one provider incident take out both
  the primary and the backup" reasoning as the database.
- Uploaded files are content-addressed by `storageKey`
  (`src/lib/storage/`) and their checksum is recorded
  (`ProductFile.checksumSha256`) — a restored bucket can be verified
  against the database's own checksums to confirm nothing was corrupted
  in transit.

## Restore process

1. **Database**: restore the snapshot/PITR point into a **new** database
   instance first — never restore directly over a live one. Point a
   staging deployment's `DATABASE_URL` at it, run the app's smoke tests
   (`npm run test:e2e` against it, or at minimum manually verify sign-in,
   browsing, and checkout) before cutting production traffic over.
2. **Object storage**: restore the bucket (or the specific objects, if
   using versioning to recover from a partial loss) from your replication
   target/backup.
3. **Cut over**: update `DATABASE_URL` (and `STORAGE_*` if storage also
   moved) in your production environment's secret manager, redeploy.
4. **Verify**: check `/api/health`, spot-check a few real user flows
   (sign-in, an existing order's download, the admin finance dashboard's
   numbers matching what you'd expect), and check `/admin/queues` for any
   jobs that need re-triggering.

## Recovery time/point objectives

Not formally set for this project — define these for your actual
deployment based on business needs (e.g. "RPO: 1 hour of data loss is
acceptable, RTO: back up within 4 hours") and size your backup frequency
and restore-drill cadence to match. A financial ledger + active
subscriptions system generally wants a tighter RPO than a content-only
site would.

## Secret management

- **Never** commit real secrets to the repository — `.env.example` exists
  specifically so `.env` (gitignored) never needs to be.
- Use your platform's secret manager (AWS Secrets Manager, Vercel
  environment variables, Doppler, etc.) to inject secrets at deploy/runtime
  rather than baking them into a Docker image layer or a config file in
  version control.
- **Recovery path**: if the person/account holding your secret manager
  access is unavailable, who else can rotate `AUTH_SECRET` or database
  credentials? Document this explicitly for your team/org — an
  unrecoverable secret manager is itself a disaster-recovery gap this
  document can't solve generically.
- Rotate `AUTH_SECRET` only when necessary — rotating it invalidates every
  active session (every signed-in user is logged out).

## Environment recovery

If you need to rebuild the entire deployment from scratch (not just
restore data): `docs/DEPLOYMENT.md` documents what a fresh environment
needs (env vars per `docs/ENVIRONMENT.md`, `npx prisma migrate deploy` to
bring a fresh database to the current schema, `npm run db:seed` only for a
non-production/demo environment — never run the demo seed against
production).
