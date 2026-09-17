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
     `next.config.ts`'s `output: "standalone"` produces — `npm run build`
     now also copies `public/`/`.next/static/` into it automatically,
     see step 4)
   - Application URL: `fxbothub.com`
4. **hPanel → the domain → Git**: connect
   `https://github.com/chalo24mulwa/FX-Bot-Hub` on branch `main`.
   **Confirmed by inspecting an actual deploy** (not speculation): there
   is no custom build-script field — Hostinger's pipeline is fixed as
   `npm install` (which runs this repo's own `postinstall` → `prisma
   generate`) then `npm run build`. `npm run build` triggers the repo's
   `postbuild` script automatically (npm's standard lifecycle hook —
   see `scripts/hostinger-postbuild.mjs`), which copies `public/` and
   `.next/static/` into `.next/standalone/` the way Next.js's standalone
   output needs — no extra configuration needed on Hostinger's side for
   that part.
   **Not automatic**: running `npx prisma migrate deploy` after a schema
   change, and restarting the app process to pick up a new build (check
   hPanel's Node.js panel for a "Restart"/redeploy action, or the
   Passenger convention of `touch tmp/restart.txt` in the app root) —
   both need to be done manually (or ask me to run them over SSH) after
   a deploy that changes the schema or needs the new build live.
5. **hPanel → the domain → Node.js → Environment variables**: set these
   directly in hPanel (never commit them, never paste real secrets into
   chat — see `docs/ENVIRONMENT.md` for the full reference).
   **Do not wrap values in quotes** — Hostinger's env loader (backed by
   `~/domains/<domain>/hbuilds/config/.env`, at least via SSH) does not
   strip surrounding `'` or `"` characters the way a typical dotenv
   parser does; a value entered as `"https://fxbothub.com"` is read back
   literally including the quote marks, which silently breaks anything
   that parses it strictly (`new URL(...)` in `src/app/layout.tsx` threw
   `ERR_INVALID_URL` on exactly this — a real deploy failure this
   caused). A value like `DATABASE_URL` that's just checked for
   non-emptiness (`z.string().min(1)`) won't fail the *build* the same
   way, but is silently broken at *runtime* instead — worth
   double-checking specifically, since that failure mode is quieter.

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

## Status for fxbothub.com specifically

- ✅ `DATABASE_URL` — Neon project `red-moon-78624956`, `production`
  branch. Schema fully migrated (`npx prisma migrate deploy`, all 15
  migrations applied) — see step 6 below for re-running this after
  future schema changes. Neon's own onboarding demo table
  (`playing_with_neon`) was dropped first — it isn't part of this app's
  schema.
- ✅ `AUTH_SECRET` / `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` — set
  directly in Hostinger's build env file (`hbuilds/config/.env`, over
  SSH) after a deploy failed on a missing `AUTH_SECRET`. The first
  attempt at this quoted the values (`KEY="value"`), which caused a
  second deploy failure (`ERR_INVALID_URL` — see the quoting note
  above); rewritten unquoted and re-verified. **Also add these three in
  hPanel's own Environment Variables panel** if you haven't already —
  that panel is presumably what regenerates this file, so a value only
  added over SSH may not survive the next time you edit env vars there.
  If you do add them there, don't wrap them in quotes either.
- ⬜ `REDIS_URL`, `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL`,
  `PAYMENT_PROVIDER`, `EMAIL_PROVIDER` — not set yet, see the table
  above.

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
