import { db } from "@/lib/db";
import type { AnalyticsEventType, Prisma } from "@prisma/client";

export interface TrackEventInput {
  type: AnalyticsEventType;
  userId?: string;
  productId?: string;
  /** Small, non-identifying context only — e.g. {"query": "trend ea"} for
   * SEARCH. Never put free-text user input that could contain PII here
   * beyond what the visitor themselves typed into a public search box. */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget event recording — callers should `void track(...)`, never
 * await it on a request's critical path. Deliberately does NOT duplicate
 * events this app already records elsewhere in a dedicated, richer table:
 * favorites (Favorite), downloads (Download), purchases (Order/OrderItem/
 * Invoice) all have their own models already and are queried directly for
 * analytics — adding a second, thinner copy of the same fact into
 * AnalyticsEvent would just be a maintenance burden with no new
 * information. What this DOES add: PRODUCT_VIEW as a time series (the
 * existing Product.viewCount is a single incrementing counter with no
 * history), and SEARCH query volume (nothing tracked this before at all).
 * See the AnalyticsEvent model comment in schema.prisma for the privacy
 * posture (no IP/UA, userId nullable, metadata kept minimal).
 */
export async function track(input: TrackEventInput): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        type: input.type,
        userId: input.userId,
        productId: input.productId,
        metadata: input.metadata,
      },
    });
  } catch {
    // Analytics must never break the page it's tracking.
  }
}
