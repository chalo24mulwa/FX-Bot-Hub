# Performance

## Where the time goes on production

| Hop | Cost |
| --- | --- |
| Visitor to the Hostinger edge (CDN) | ~0.1–0.15 s (TLS) + whatever the visitor's own network adds |
| Edge to the app server (Manchester, UK) | ~0.1 s |
| **App server to the database (Neon, `us-east-2`, Ohio)** | **~0.1 s per round trip** (measured: TCP connect 97 ms) |

The application itself is fast. A page that needs five database queries one after another spends half a second waiting on the
Atlantic. Every optimisation below is therefore about **doing fewer round trips**, not about faster code.

### The single biggest remaining lever: put the database next to the server

The app server is in the UK, the database is in Ohio. Creating the Neon project in `aws-eu-west-2` (London) takes a database round
trip from ~100 ms to ~2 ms and makes every uncached page and every button roughly 5–10x faster, with no code change. Steps:

1. In Neon create a new project in **AWS Europe (London) `eu-west-2`**, same Postgres version, and copy its (pooled) connection string.
2. Dump and restore: `pg_dump --no-owner --no-acl "<old connection string>" | psql "<new connection string>"`
   (or `neon branch`/import). The database is small.
3. In hPanel (Node.js app → environment) replace `DATABASE_URL` with the new string and redeploy; check `/api/health` is `ok`.
4. Keep the old project for a few days as a fallback, then delete it.

Nothing else in the codebase refers to the region.

## What the code does about it

* **In-process page cache** (`src/lib/cache.ts`). There is no Redis on this plan, so `cacheWrap()` keeps values in memory:
  fresh for the TTL, then served stale-while-revalidating for one more TTL while a single background refresh runs, concurrent
  callers share one computation, values are cloned on the way out. Writers call `invalidateCachePrefix()`
  (`src/lib/product-cache.ts` for products; the VPS/brokers/partnership/signals services for theirs). With a healthy Redis the same
  function uses Redis exactly as before. `CACHE_MEMORY_DISABLED=true` switches the memory tier off (the Playwright suite sets it,
  because its specs write to the database directly and read it straight back).
* **What is cached** (all public, same for every visitor): home sections, the marketplace listing for every filter/sort/search,
  product pages, VPS and broker pages, news, the calendar, signals, the signed-out community feed, partnership promo settings.
  Per-visitor data (favourite flag, ownership, own review, dashboards, cart) is never shared.
* **Warm-up** (`src/instrumentation.ts`, `src/lib/warmup.ts`): every 45 s a `SELECT 1` keeps the connection and the database compute
  awake (a serverless Postgres suspends when idle; the first visitor after a quiet spell used to pay for that), and the busiest public
  listings are re-read just before their cache entries expire. `DISABLE_WARMUP=true` turns it off.
* **Fewer round trips per request**: the marketplace page runs its listing, landing and favourites queries side by side; the
  product page passes what it already knows to the entitlement and review checks; signed-in dashboard, cart, orders, licences,
  favourites and the product pages use Prisma's `relationLoadStrategy: "join"` (one SQL statement instead of one per relation —
  needs the `relationJoins` preview feature enabled in `prisma/schema.prisma`); cart writes are single statements and the cart
  buttons no longer re-read the whole cart; favourite toggles take one trip when removing.
* **Redis is skipped instantly when it is not configured/ready** (`redisReady()`), instead of waiting out a timeout per lookup.

## Measured (database 100 ms away, simulated with a delaying TCP proxy; server time to first byte)

| Page | Before | After (warm) |
| --- | --- | --- |
| Home | 0.9–1.8 s | 0.02 s |
| Marketplace | 0.67–1.2 s | 0.02 s |
| Product page | 1.3–2.2 s | 0.01 s |
| VPS / Best Brokers | 0.15 s | 0.01 s |
| News | 0.27 s | 0.01 s |
| Calendar | 0.27–0.5 s | 0.02 s |
| Signals | 0.26 s | 0.01 s |
| Community (signed out) | 1.5–1.9 s | 0.02 s |
| Signed in: orders / licences / cart / favourites | 0.5–0.8 s | 0.15–0.2 s |
| Signed in: product page | 0.5–0.7 s | 0.3 s |
| Add to cart / remove from cart | 2.6 s / 1.5 s | 0.5–0.65 s / 0.15 s |

The first request after a deploy or restart is slower (cold connection, empty cache); the warm-up reduces that.

## What is still slow, and why

* The signed-in community feed (~1.2 s): its like/save flags and sidebar are many sequential queries. Splitting the per-viewer flags
  from the shared feed (so the shared part can be cached) is the fix.
* Admin and seller back-office pages are per-user and uncached; they are bounded by round trips (move the database, above).
* Anything that writes (checkout, publishing, uploading) needs at least one database round trip plus the visitor's own network.
