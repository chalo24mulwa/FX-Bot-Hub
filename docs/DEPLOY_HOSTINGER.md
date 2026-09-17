# Deploying to Hostinger (shared hosting) — fxbothub.com

This is a second, concrete deployment path alongside the generic
Docker/VPS process in `docs/DEPLOYMENT.md` — for a **Hostinger shared
hosting plan** (confirmed via SSH: CloudLinux-based, no root, no Docker,
no local PostgreSQL/Redis service — see the account survey this doc is
based on). Everything in `docs/DEPLOYMENT.md`'s "no staging/production
separation" and "no deploy job in CI" caveats still applies; this
supplements it rather than replacing it.

## Why this looks different from the Docker path

Shared hosting can't run this app's full stack directly:

| Piece | Docker/VPS path | Hostinger shared hosting |
| --- | --- | --- |
| Next.js app | container | Node.js App (CloudLinux Node Selector — 18/20/22/24 available), Passenger-managed |
| PostgreSQL | `docker-compose` service | **external** managed Postgres (e.g. Neon, Supabase) |
| Redis | `docker-compose` service | **external** managed Redis (e.g. Upstash) |
| BullMQ workers (`worker:*`) | separate long-lived containers | **not currently run** — see "Known gap" below |
| Sync trigger scripts (`sync:trigger`) | external cron → the container | hPanel's Cron Jobs UI → the app process (`crontab` isn't available over SSH on this plan; use hPanel's web UI) |

## One-time setup

1. **External Postgres**: create a free/cheap instance (Neon is a common
   choice — serverless Postgres, works over the public internet). Get its
   connection string for `DATABASE_URL`.
2. **External Redis**: create one (Upstash is a common choice — supports
   the standard Redis protocol over TLS, which `ioredis`/`REDIS_URL` need
   — make sure you copy the `rediss://` TLS connection string, not a
   REST-API-only URL). Get its connection string for `REDIS_URL`.
3. **hPanel → the domain → Node.js**: create a Node.js Application:
   - Node.js version: 22 (or latest available — matches `engines`/CI)
   - Application root: wherever you clone the repo, e.g.
     `domains/fxbothub.com/fxbothub-app` (**not** `public_html` directly —
     see the `DO_NOT_UPLOAD_HERE` marker Hostinger already placed there)
   - Application startup file: `.next/standalone/server.js` (this is what
     `next.config.ts`'s `output: "standalone"` produces — see
     `npm run build:standalone` below)
   - Application URL: `fxbothub.com`
4. **hPanel → the domain → Git**: connect
   `https://github.com/chalo24mulwa/FX-Bot-Hub` on branch `main`. If it
   offers a custom deploy/build script field, use:
   ```bash
   npm ci
   npm run build:standalone
   npx prisma migrate deploy
   touch tmp/restart.txt
   ```
   (`touch tmp/restart.txt` is the standard Passenger convention for
   telling it to reload the app after a deploy — if hPanel exposes its
   own "Restart" action/webhook instead, use that.) If the Git panel only
   supports a raw `git pull` with no script step, the build/restart steps
   need to run manually (over SSH) after each pull instead — tell me
   which one you see and I'll adjust this doc.
5. **hPanel → the domain → Node.js → Environment variables**: set these
   directly in hPanel (never commit them, never paste real secrets into
   chat — see `docs/ENVIRONMENT.md` for the full reference):

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | your Neon (or other) connection string |
   | `REDIS_URL` | your Upstash (or other) `rediss://` connection string |
   | `AUTH_SECRET` | generate with `npx auth secret` |
   | `NEXTAUTH_URL` | `https://fxbothub.com` |
   | `NEXT_PUBLIC_APP_URL` | `https://fxbothub.com` |
   | `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` | your object storage's public base URL (S3/R2/MinIO — required for product images to render) |
   | `PAYMENT_PROVIDER` | **not** `manual` once accepting real payments — see `docs/ENVIRONMENT.md` |
   | `EMAIL_PROVIDER` | **not** `console` — set `resend` + `RESEND_API_KEY` for real delivery |
   | `RATE_LIMIT_DISABLED` | leave unset |

6. **Run the initial migration** (one-time, from wherever you have the
   real `DATABASE_URL` — locally or via SSH once the app root has
   `node_modules` installed):
   ```bash
   npx prisma migrate deploy
   ```

## Known gap: background workers and sync jobs

Nothing currently runs `npm run worker:*` continuously on this plan, so:

- Calendar/news/market-data sync (`runCalendarSync`/`runNewsSync`), email
  sending (`enqueueEmail`), event reminders, and subscription renewals
  are all enqueued onto BullMQ (once `REDIS_URL` is set) but **nothing
  consumes the queue** — jobs sit unprocessed.
- The web app itself (marketplace, auth, checkout, the calendar's direct
  DB reads, the hero chart) is unaffected — none of it depends on a
  worker being alive.

This is a deliberate, scoped gap, not an oversight — see CLAUDE.md's
"Deploying to Hostinger" section for the two ways to close it (adapt the
workers to a cron-friendly "drain and exit" mode, or move to a host that
can run a persistent process for them) once you're ready to take it on.

## Verifying a deploy

```bash
curl -I https://fxbothub.com/api/health
```

then sign in, browse the marketplace, and check the homepage hero chart
renders (it will show its "not configured" state until a real
`MARKET_DATA_API_KEY` is set — see CLAUDE.md's "Homepage hero" section,
that's expected, not a bug).
