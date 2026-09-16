# Environment variables

Parsed and validated at boot by `src/lib/env.ts` (Zod) — the app fails fast
on startup if a required variable is missing, rather than failing obscurely
deep in a request handler. Copy `.env.example` to `.env` for local
development; it already has working defaults for the Docker Compose stack.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Set by the platform in most deployments; don't hard-code `production` in `.env`. |
| `DATABASE_URL` | **Yes** | — | Postgres connection string. See `docs/DATABASE.md` for connection-pooling guidance in production. |
| `REDIS_URL` | No | `redis://localhost:6379` | Backs caching, rate limiting, and every BullMQ queue. The app degrades (not crashes) if unreachable — see `docs/OBSERVABILITY.md`. |
| `AUTH_SECRET` | **Yes** | — | Auth.js session/JWT signing secret. Generate with `npx auth secret`. Rotating it invalidates every existing session. |
| `NEXTAUTH_URL` | Recommended in prod | — | The app's own canonical URL. Auth.js needs this (with `trustHost: true`, already set in `src/lib/auth.ts`) for any deployment that isn't Vercel. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | No | unset | **Server-only — never exposed to the client.** Google sign-in registers automatically only when **both** are set (see `src/lib/auth.ts`), and the "Continue with Google" button on the sign-in/sign-up pages only renders when it's actually registered. Redirect URI to register in Google Cloud Console: `<your-url>/api/auth/callback/google`. A Google sign-in whose email matches an existing credentials account is safely linked to it (not duplicated) — see CLAUDE.md's "Authentication enhancement" section. |
| `STORAGE_ENDPOINT` | No | unset (falls back to AWS default) | S3-compatible endpoint — set for MinIO/R2/DigitalOcean Spaces; leave unset for real AWS S3. |
| `STORAGE_REGION` | No | `us-east-1` | |
| `STORAGE_BUCKET` | No | `fx-bot-market` | |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Effectively required (uploads fail without them) | unset | Credentials for the bucket above. |
| `STORAGE_FORCE_PATH_STYLE` | No | `false` | Set `true` for MinIO/most non-AWS S3-compatible services. |
| `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` | **Yes** for any page showing product images | — | Public-read base URL for product images. `NEXT_PUBLIC_` because it's read directly in the browser (`src/lib/storage/public-url.ts`) — never put a secret in a `NEXT_PUBLIC_` variable. |
| `RATE_LIMIT_DISABLED` | No | `false` | Bypasses Redis-backed rate limiting entirely. **Never set `true` in production** — it's a manual override for environments without Redis (e.g. some CI runs), and rate limiting already fails open automatically if Redis is merely unreachable. |
| `NEXT_PUBLIC_APP_URL` | Recommended | `http://localhost:3000` | Used to build absolute URLs in the sitemap, emails, and Open Graph tags. |
| `EMAIL_PROVIDER` | No | `console` | `console` logs instead of sending — fine for local dev, **must** be `resend` (or a future real provider) in production or no emails are actually delivered. |
| `RESEND_API_KEY` | Required if `EMAIL_PROVIDER=resend` | unset | |
| `EMAIL_FROM` | No | `fx Bot Hub <no-reply@fxbotmarket.local>` | Must be a verified sending domain/address with your email provider in production. |
| `PAYMENT_PROVIDER` | No | `manual` | **`manual` must never be set in production** — it marks every order paid instantly with no real charge. See the PRODUCTION REQUIREMENT note in `CLAUDE.md` and the Phase 5 hard-stop on `/api/payments/webhook` when this is misconfigured. Switch to `stripe` or `mpesa` once one is actually implemented (currently typed stubs — see `src/lib/payments/`). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Required once Stripe is implemented | unset | Not yet wired to a real Stripe integration — see `src/lib/payments/stripe-provider.ts`. |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` | Required once M-Pesa is implemented | unset | Not yet wired to a real Safaricom Daraja integration — see `src/lib/payments/mpesa-provider.ts`. Per product direction, prefer M-Pesa Till / a direct bank-linking integration over Stripe for this market when this is built out. |
| `ECONOMIC_CALENDAR_PROVIDER` | No | `manual` | `manual` needs no credentials (admins enter events at `/admin/calendar`). Switch to `authorized` — and enable the `authorized` DataSource row at `/admin/data-sources` — only once `ECONOMIC_CALENDAR_API_KEY` is a real, licensed key. |
| `ECONOMIC_CALENDAR_API_KEY` | Required once `ECONOMIC_CALENDAR_PROVIDER=authorized` | unset | **Server-only — never exposed to the browser, a Client Component, or any API response.** See `src/services/calendar/providers/authorized-provider.ts`. |
| `ECONOMIC_CALENDAR_API_URL` | No | `https://api.tradingeconomics.com` | The licensed calendar API's base URL. Only Trading Economics' documented response shape is currently mapped (`RawEventSchema` in `authorized-provider.ts`) — pointing this at a different provider means updating that mapping too. |
| `ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS` | No | `90` | How many days ahead of "now" each `calendarSync` run requests — 90 (about 3 months) so the calendar's "Next 3 Months" quick range has real data to show once a real provider is enabled; capped at 90 (`src/lib/env.ts`). |
| `ECONOMIC_CALENDAR_SYNC_RECENT_DAYS` | No | `3` | How many days behind "now" each `calendarSync` run requests — catches actual/previous revisions on events that already released. |
| `ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES` | No | `60` | **Informational only** — there is no in-process scheduler (see `CLAUDE.md`'s established external-cron model). This is what your cron/scheduler should be set to; used only to estimate "next sync" at `/admin/data-sources`. |
| `ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS` | No | `60` | How often the calendar page's client-side auto-refresh re-fetches without a full reload. `0` disables it. |

## Secrets checklist before a production deploy

- [ ] `AUTH_SECRET` is a real random value, not the placeholder, and is not committed anywhere.
- [ ] `DATABASE_URL` points at the production database, uses a non-superuser role, and is not logged anywhere (see `docs/SECURITY.md`).
- [ ] `PAYMENT_PROVIDER` is **not** `manual`.
- [ ] `EMAIL_PROVIDER` is **not** `console`.
- [ ] If the economic calendar must show real data, `ECONOMIC_CALENDAR_PROVIDER=authorized`, `ECONOMIC_CALENDAR_API_KEY` is a real licensed key, and the `authorized` DataSource row is enabled at `/admin/data-sources` — otherwise the calendar stays admin-managed only (`manual`), which is a legitimate choice, not a bug.
- [ ] `RATE_LIMIT_DISABLED` is unset or `false`.
- [ ] `NEXT_PUBLIC_*` variables contain nothing sensitive — anything in them ships to every visitor's browser.
- [ ] Secrets are injected via your platform's secret manager (see `docs/BACKUP.md`'s "Secret management" section), not baked into a committed `.env` file or a Docker image layer.
