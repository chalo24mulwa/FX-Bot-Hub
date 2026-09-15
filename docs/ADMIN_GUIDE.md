# Admin guide

Everything below lives under `/admin`, gated to staff roles
(`MODERATOR`/`ADMIN`/`SUPER_ADMIN` — see `CLAUDE.md`'s RBAC section for the
exact hierarchy and which actions need which rank).

## Moderation

- **Products** (`/admin/products`) — claim → approve / reject (with a
  reason, shown to the seller) / suspend / feature. Claiming assigns you
  as the moderator so two staff don't collide on the same review.
- **Reviews** (`/admin/reviews`) — hide (default, reversible) rather than
  delete; full history of every moderation action is in the audit log,
  not a separate table.
- **Users** (`/admin/users`) — change role, ban/unban. A role/ban change
  takes effect for that user's *current* session within ~60 seconds
  automatically (or immediately if they're mid-action on something that
  triggers a resync) — no need to ask them to sign out.
- **Categories** (`/admin/categories`) — create/delete; a category with
  products assigned can't be deleted until they're moved or removed.

## Content

- **Calendar** (`/admin/calendar`) — manually create/edit/delete economic
  events; synced providers also write here (`source ≠ "manual"` for
  those rows).
- **News** (`/admin/news`, `/admin/news-categories`) — create articles
  (draft or publish immediately), publish/unpublish, manage categories.
  Summaries only — never paste a full source article's text.
- **Signal providers / signals** (`/admin/signal-providers`,
  `/admin/signals`) — verify a provider (marks their stats as
  independently confirmed, not just self-reported — see the "Signal
  providers" note below) or remove an individual signal (marks it
  cancelled, hides it from the public feed without deleting the record).
- **Data sources** (`/admin/data-sources`) — enable/disable and register
  calendar/news sync sources; see recent sync run status here too (also
  visible, alongside all queues, at `/admin/queues`).

## Commerce

- **Finance** (`/admin/finance`) — gross sales, net marketplace revenue,
  seller revenue, commissions collected, refunds, active subscriptions,
  outstanding seller balances, with date-range filters (today/7d/30d/
  month/year/custom via the date presets shown).
- **Refunds** (`/admin/refunds`) — approve (charges the refund through the
  payment provider immediately and reverses the order's licenses/
  subscriptions/ledger entries in one step — there's no separate
  "capture" step to wait on) or reject a request.
- **Payouts** (`/admin/payouts`) — mark a seller's payout request
  processing/paid/failed. **No payout processor is wired up** — this
  tracks the request; you move the actual money through whatever channel
  is currently in use (bank transfer, M-Pesa, etc.) and mark it here once
  done.
- **Licenses** (`/admin/licenses`) — suspend (reversible hold) or revoke
  (permanent) any buyer's license. Both take effect immediately on their
  next download attempt and on the `/api/licenses/verify` response an EA
  would see.
- **Settings** (`/admin/settings`) — the marketplace commission
  percentage (applied to every future sale, not retroactively) and the
  marketplace ranking weights (sales/downloads/reviews/rating/recency/
  favorites/quality — see "Ranking" below).

## Security & operations

- **Security events** (`/admin/security`) — repeated payment failures,
  suspicious download volume, invalid webhook signatures, license-
  activation abuse, possible review-abuse patterns. **These are signals
  for you to review, not automatic actions** — nothing here bans or
  suspends anyone on its own. Investigate a flagged account before acting
  on it (check their order/download/review history for context).
- **Background jobs** (`/admin/queues`) — per-queue job counts and recent
  sync-job run history. A non-zero "failed" count that isn't shrinking on
  its own is worth investigating (check the worker's own log output).
- **Audit logs** (`/admin/audit-logs`) — append-only trail of every
  moderation/role-change/settings/finance action, who did it, and when.
- **Analytics** (`/admin/analytics`) — product view/search volume,
  top-viewed products with their view→purchase conversion, top search
  queries. Favorites/downloads/purchases already have their own detailed
  records elsewhere (not duplicated here) — see `docs/ARCHITECTURE.md`.

## Ranking

The marketplace's "Popular"/"Best Sellers" sort is a weighted blend of
sales, downloads, reviews, rating, recency, favorites, and (Phase 5) a
product-quality checklist score — **never price**. Adjust weights at
`/admin/settings`; a weight of `0` removes that factor from ranking
entirely rather than just reducing its influence. Changes take effect
within the ranking cache's TTL (≤90 seconds), not instantly.

## Product quality signals

Shown on every product's public page: documentation present, screenshots
present, compatibility info present, recently updated (within ~6 months),
verified seller, verified-purchase reviews present. This is a listing-
completeness/trust checklist only — **never** a claim that a product is
profitable or safe to trade. Don't describe it to sellers or buyers as
performance validation.
