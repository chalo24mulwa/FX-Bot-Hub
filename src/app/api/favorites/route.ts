import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { toggleFavorite } from "@/features/favorites/favorite-service";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({ productId: z.string().cuid() });

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    // Phase 5 anti-manipulation: favorites feed the marketplace ranking
    // score, so unlimited toggling is a manipulation vector, not just a
    // performance concern (docs/PHASE5_AUDIT.md's "Advanced Marketplace
    // Ranking" section).
    await checkRateLimit(session.user.id, { bucket: "favorite:toggle", limit: 60, windowSeconds: 60 });
    const { productId } = bodySchema.parse(await request.json());
    const favorited = await toggleFavorite(session.user.id, productId);
    return NextResponse.json({ favorited });
  });
}
