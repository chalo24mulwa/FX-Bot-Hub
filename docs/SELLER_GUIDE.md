# Seller guide

Everything below lives under `/seller`, gated to the `SELLER` role (start
selling from `/dashboard/become-seller` — instant, self-service).

## Listing a product

The product wizard (`/seller/products/new`) walks through: type
(EA/indicator/signal/tool) → platform (MT4/MT5/multi) → basic info →
description → features → screenshots → documentation → files → pricing →
compatibility → testing/support → submit for review. A draft can be saved
and resumed at any step; nothing is public until you submit it and an
admin approves it.

**Pricing types**: `FREE` (priceCents must be 0), `ONE_TIME` (single
purchase), `SUBSCRIPTION` (recurring — billed automatically every ~30
days until the buyer or you cancels; see "Subscription products" below).

**Files**: uploaded directly to object storage via a presigned URL — the
platform's own servers never see the file bytes in transit. A checksum is
recorded automatically; buyers' downloads are verified against it.

## Getting approved

After submission, a product sits in `PENDING_REVIEW` until a moderator
claims it (`UNDER_REVIEW`) and either approves it (goes live immediately
as `PUBLISHED`) or rejects it with a reason (shown to you, editable and
resubmittable). There's no fixed SLA — check your notifications
(`/dashboard/notifications`) for the outcome.

## Product quality signals

Every published product shows a completeness/trust checklist to buyers:
documentation, screenshots, compatibility info, recently updated (within
~6 months), verified-seller badge, verified-purchase reviews. These also
feed into marketplace ranking (see below) — keeping documentation current
and updating your product periodically both help visibility, independent
of sales volume.

**Verified seller** status is admin-granted, not self-service — it isn't
something you can turn on from your profile.

## Getting found: marketplace ranking

"Popular"/"Best Sellers" sort is a blend of sales, downloads, reviews,
rating, recency, favorites, and the quality checklist above — **never
price**, and never something you can pay to boost. The specific weights
are admin-configurable and visible in aggregate effect, not published as
exact numbers.

## Orders, licensing, and downloads

- **Orders** (`/seller/orders`) — every sale, buyer, amount, and status.
- Every sale automatically issues the buyer a **license** (one-time/free
  products) or activates a **subscription** (recurring products) — you
  don't do anything manually here.
- **License activation limits**: buyers' EAs/indicators activate against
  your product's configured `maxActivations` per license — this is
  informational for you (via `/admin/licenses` if a buyer needs help, ask
  an admin), not something you manage directly today.

## Subscription products

A `SUBSCRIPTION`-priced product bills the buyer automatically every ~30
days. If a renewal charge fails, the subscription goes `PAST_DUE` (not
immediately cancelled) and the buyer is emailed; if they cancel, it stays
active through the period they already paid for, then expires — they
don't lose access mid-period. You see the same `ORDER_PAID` notification
and sale email for a renewal as for the original purchase.

## Payout & balance (`/seller/payout`)

Every sale posts a `SALE` credit and a `COMMISSION` debit (at the
marketplace's current commission rate) to your ledger — your **balance is
always the sum of your own ledger history**, visible on this page along
with recent activity. Request a payout once your balance clears the
minimum threshold shown; an admin marks it processed once the money has
actually moved (no payout processor is wired up yet — see the Payout
Settings section of this page for where payouts are sent).

A refund on one of your sales posts an offsetting `REFUND` entry that
reverses your net share of that sale — it doesn't just disappear from
your history.

## Reviews

Buyers can only leave a review after a real purchase; whether it's
verified is computed automatically (**never** something you or the buyer
can toggle). Respond to a review from `/seller/reviews` — your response is
shown publicly alongside it.

## Analytics (`/seller/analytics`, and your dashboard overview)

Views, favorites, sales, revenue, downloads, conversion rate, rating, all
filterable by date range (7/30/90 days or all time). **One caveat**: a
date-ranged view count reflects tracking that went live in Phase 5 — "all
time" instead uses the product's full historical view counter, which
predates that tracking, so the two aren't the same measurement stitched
together seamlessly.

## Invoices

Every sale generates an invoice automatically, viewable from the relevant
order (buyer-side) — there's no separate seller-side invoice list yet; use
`/seller/orders` to find the relevant order.
