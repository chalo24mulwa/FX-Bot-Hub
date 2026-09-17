# Deployment guide

## What exists today

- `Dockerfile` — multi-stage build producing a minimal standalone image
  (`output: "standalone"` in `next.config.ts`), suitable for any container
  platform (ECS, Cloud Run, Fly.io, a bare VM running Docker, etc.).
- `docker-compose.yml` — Postgres + Redis + MinIO + the app itself, for a
  production-*like* local environment (not a production deployment on its
  own).
- `.github/workflows/ci.yml` — **validates only**: install, `npm audit`,
  migration check, lint, typecheck, unit tests, e2e tests (against a real
  production build), production build. It does **not** deploy anywhere —
  there is no target hosting provider wired into this repo yet. Add a
  deploy job once you've picked one; see "Adding a deploy job" below.

## No staging/production environment separation yet

There is one `.env`/`.env.example` pair and one `next.config.ts` — no
`.env.staging`, no second CI workflow, no environment-specific build
config. This is a real gap for a team running more than a single
environment, and deliberately not fabricated here (a fake staging config
with no actual staging infrastructure behind it would be worse than
nothing). To add real separation:

1. Decide your environments (commonly: development → staging →
   production).
2. Give each its own secret set in your platform's secret manager (not
   separate `.env` files committed to the repo — see `docs/BACKUP.md`'s
   "Secret management" section).
3. Add a `deploy` job per environment to `ci.yml` (or split into separate
   workflow files), gated on branch (`staging` branch → staging deploy,
   `main` → production deploy) and on the existing validation job
   succeeding first — **never deploy if the validation job fails**.

## Deploying (manual process, until a deploy job exists)

1. Provision Postgres, Redis, and S3-compatible object storage (see
   `docs/ENVIRONMENT.md` for exactly which variables each needs).
2. Set every required environment variable in your platform's secret
   manager (see `docs/ENVIRONMENT.md`'s secrets checklist —
   `PAYMENT_PROVIDER` must not be `manual`, `EMAIL_PROVIDER` must not be
   `console`).
3. Build and push the Docker image:
   ```bash
   docker build -t fx-bot-market:<tag> .
   docker push <your-registry>/fx-bot-market:<tag>
   ```
4. Apply pending migrations against the production database (do this
   **before** rolling out the new image, from a one-off task/job with
   `DATABASE_URL` set to production):
   ```bash
   npx prisma migrate deploy
   ```
5. Roll out the new image to your container platform.
6. Start the background workers as separate long-lived processes/
   containers (not inside the web request path) — one per queue, or one
   process running all of them if your platform doesn't support multiple
   process types cheaply:
   ```bash
   npm run worker:email
   npm run worker:calendar-sync
   npm run worker:news-sync
   npm run worker:market-data-sync
   npm run worker:event-reminder
   npm run worker:subscription-renewal
   ```
7. Schedule the sync/renewal trigger scripts on your platform's own cron
   equivalent (there is no in-process scheduler — see `CLAUDE.md`'s Phase
   3/4 sections for why):
   ```bash
   npm run sync:trigger              # calendar + news + market-data sync — every few minutes to hourly
   npm run subscriptions:renew       # product subscription renewals — daily
   ```
8. Point your platform's health check at `GET /api/health`.
9. Verify: sign in, browse the marketplace, complete a checkout with
   whatever real payment provider you've configured, confirm an email
   actually arrives, check `/admin/queues` and `/admin/security` for
   anything unexpected.

## Adding a deploy job to CI

Once you've picked a target, the shape to add to `ci.yml` after the
existing validation steps (as a job that `needs: test` so it only runs if
everything else passed):

```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    # ... build/push the Docker image, run `prisma migrate deploy` against
    # production, trigger your platform's rollout (a CLI action, a webhook,
    # etc. — specific to whatever platform you choose).
```

## Rollback

- **App**: redeploy the previous image tag — the standard container
  rollback for whatever platform you're on.
- **Database**: Prisma migrations are additive by convention in this
  project's history (no destructive migration has dropped a column/table
  in place) — a rollback that doesn't also need a matching migration
  rollback is the common case. If a migration ever needs a down-migration,
  write and test it explicitly; none exist in this repo today since none
  has been needed yet.

## Alternative: shared hosting (no Docker/root access)

`docs/DEPLOY_HOSTINGER.md` covers deploying to a shared hosting plan
(confirmed against Hostinger specifically, for fxbothub.com) instead of
the Docker/VPS path above — a different shape (external managed
Postgres/Redis, a CloudLinux-managed Node process instead of a
container, no persistent background workers yet) driven by what that
kind of hosting can actually run, not a preference over the Docker path.

## See also

- `docs/ENVIRONMENT.md` — every environment variable, required vs.
  optional, and the pre-deploy secrets checklist.
- `docs/DATABASE.md` — migration workflow and connection-pooling guidance
  for serverless vs. long-lived-server deployment targets.
- `docs/DEPLOY_HOSTINGER.md` — shared-hosting deployment path (no
  Docker/root), for hosts like Hostinger that can't run the Docker path
  above directly.
- `docs/BACKUP.md` — what to back up and how to restore.
- `docs/SECURITY.md` — what to verify before shipping.
- `docs/OBSERVABILITY.md` — health checks, logging, and queue monitoring.
