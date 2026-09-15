import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

// Phase 5: public provider profile + stats were uncached reads on every
// profile-page view (docs/PHASE5_AUDIT.md). Neither getProviderBySlug's nor
// computeProviderStats's fields are ever rendered as Dates on that page (no
// createdAt/updatedAt display), so this is safe to cache as plain JSON with
// no revival needed — unlike calendar/news. Per-user overlay data
// (subscribed/alertSubscribed/isOwner) is looked up separately by the page
// itself and never touches this cache.
const PROVIDER_PROFILE_TTL_SECONDS = 60;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueProviderSlug(name: string): Promise<string> {
  const base = slugify(name) || "provider";
  let slug = base;
  let suffix = 1;
  while (await db.signalProviderProfile.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

export interface BecomeProviderInput {
  userId: string;
  displayName: string;
  bio?: string;
  tradingStyle?: string;
  markets?: string[];
}

export async function becomeSignalProvider(input: BecomeProviderInput) {
  const existing = await db.signalProviderProfile.findUnique({ where: { userId: input.userId } });
  if (existing) return existing;

  const slug = await uniqueProviderSlug(input.displayName);
  return db.signalProviderProfile.create({
    data: {
      userId: input.userId,
      slug,
      displayName: input.displayName,
      bio: input.bio,
      tradingStyle: input.tradingStyle,
      markets: input.markets ?? [],
    },
  });
}

export async function getProviderBySlug(slug: string) {
  return cacheWrap(`provider-profile:${slug}`, PROVIDER_PROFILE_TTL_SECONDS, () =>
    db.signalProviderProfile.findUnique({ where: { slug }, include: { user: { select: { name: true } } } })
  );
}

export async function getProviderByUserId(userId: string) {
  return db.signalProviderProfile.findUnique({ where: { userId } });
}

export async function listProviders(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    db.signalProviderProfile.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { signals: true, subscriptions: true } } },
    }),
    db.signalProviderProfile.count(),
  ]);
  return { items, total, page, pageSize };
}

export interface ProviderStats {
  totalSignals: number;
  closedSignals: number;
  /** null when there's no mathematically valid sample (0 closed signals) —
   * never fabricate a percentage from an empty set. */
  winRatePercent: number | null;
  averageResultPips: number | null;
  subscriberCount: number;
}

/** Everything here is computed from this app's own Signal rows — i.e.
 * self-reported by the provider's own publish/close actions, not
 * independently audited. `verified` on SignalProviderProfile (admin-set)
 * is the only thing that distinguishes "verified performance" from this —
 * see CLAUDE.md. Never present these numbers as verified unless that flag
 * is also true. */
export async function computeProviderStats(providerId: string): Promise<ProviderStats> {
  return cacheWrap(`provider-stats:${providerId}`, PROVIDER_PROFILE_TTL_SECONDS, async () => {
    const [totalSignals, closedAgg, subscriberCount] = await Promise.all([
      db.signal.count({ where: { providerId } }),
      db.signal.aggregate({
        where: { providerId, status: "CLOSED", resultPips: { not: null } },
        _count: true,
        _avg: { resultPips: true },
      }),
      db.signalSubscription.count({ where: { providerId, status: "ACTIVE" } }),
    ]);

    const closedSignals = closedAgg._count;
    let winRatePercent: number | null = null;
    if (closedSignals > 0) {
      const winning = await db.signal.count({
        where: { providerId, status: "CLOSED", resultPips: { gt: 0 } },
      });
      winRatePercent = (winning / closedSignals) * 100;
    }

    return {
      totalSignals,
      closedSignals,
      winRatePercent,
      averageResultPips: closedAgg._avg.resultPips,
      subscriberCount,
    };
  });
}
