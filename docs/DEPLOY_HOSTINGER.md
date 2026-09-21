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
   | `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_FORCE_PATH_STYLE` | your S3-compatible bucket (R2/S3/…) — **required for sellers to upload cover photos, screenshots, and product files** (uploads go browser → bucket via presigned URLs). The bucket also needs a CORS rule allowing `PUT`/`GET` from `https://fxbothub.com`, and public read on `products/*/image/*` (covers) **and `community/*`** (Community chart screenshots) so they can display. Community image uploads are switched off automatically until these are set |
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
  `PAYMENT_PROVIDER` — not set yet, see the table above.
- ⬜ `EMAIL_PROVIDER`/`RESEND_API_KEY`/`EMAIL_FROM` (password-reset email) and
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (Google sign-in) — not set yet, see
  "Sign in with Google and password-reset email" below.

## Sign in with Google and password-reset email

Both features are built and tested, but each needs **credentials that only you
can create** — until they're set, Google sign-in stays hidden and reset emails
are logged as "NOT SENT" instead of delivered. Nothing else in the app depends
on them.

**Google sign-in** (adds the "Continue with Google" button on Sign in and Sign up):

1. Google Cloud Console → *APIs & Services → Credentials → Create credentials →
   OAuth client ID → Web application*.
2. **Authorized redirect URI**: `https://fxbothub.com/api/auth/callback/google`
   (exactly — scheme, host and path; add `http://localhost:3000/api/auth/callback/google`
   as a second entry if you also want to test locally).
3. Configure the OAuth consent screen (app name, support email, `fxbothub.com`).
4. Add to hPanel's environment variables (no quotes) and redeploy:
   `AUTH_GOOGLE_ID` = the client ID, `AUTH_GOOGLE_SECRET` = the client secret.
   The secret is read on the server only; it never reaches the browser.

**Password-reset email** (the reset link is sent straight through the email
provider — no Redis or worker needed):

1. Create a [Resend](https://resend.com) account, add and **verify the sending
   domain** `fxbothub.com` (the DNS records Resend shows you), then create an API key.
2. Add to hPanel's environment variables and redeploy:
   `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=<key>`, and
   `EMAIL_FROM=fx Bot Hub <no-reply@fxbothub.com>` (the domain must be the verified one).
3. Verify: request a reset for a real account at `/auth/forgot-password`. If nothing
   arrives, check the server log for `email.send_failed` (Resend rejected it — usually an
   unverified domain or wrong key) or `[email:console] NOT SENT` (provider still `console`).

Other emails (welcome, alerts, refunds…) still go through the BullMQ queue and need
Redis plus a running worker, which this plan doesn't have — see "Known gap" below.

## Economic calendar: live feed, no worker needed

The calendar syncs itself without Redis, a worker, or cron: when
`/calendar` is viewed and the last sync is older than an hour
(`ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES`), one background sync pulls
~3 months of events from Finance Calendar into Postgres
(`src/services/calendar/auto-sync.ts`). Visitors are always served from
the database; the upstream is hit at most about once an hour. The very
first sync also backfills 30 days of history. Nothing to configure — the
Finance Calendar source registers itself.

**Optional — refresh even when nobody visits the page.** Set a
`CRON_SECRET` (16+ random characters) in hPanel's environment variables,
redeploy, then add an hPanel **Cron Job** (web UI) running every hour or
more often (it only syncs if a sync is actually due):

```bash
curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://fxbothub.com/api/cron/calendar-sync
```

To check it manually: the same URL with `?force=1` runs a sync now and
returns counts as JSON.

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
