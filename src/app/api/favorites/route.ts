import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { toggleFavorite } from "@/features/favorites/favorite-service";
import { assertSameOrigin } from "@/lib/security/csrf";

const bodySchema = z.object({ productId: z.string().cuid() });

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const { productId } = bodySchema.parse(await request.json());
    const favorited = await toggleFavorite(session.user.id, productId);
    return NextResponse.json({ favorited });
  });
}
