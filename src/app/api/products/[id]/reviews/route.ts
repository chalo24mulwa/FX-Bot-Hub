import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { submitReview, ReviewError } from "@/features/reviews/review-service";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await params;
    const input = bodySchema.parse(await request.json());

    try {
      const review = await submitReview({ productId: id, userId: session.user.id, ...input });
      return NextResponse.json(review, { status: 201 });
    } catch (err) {
      if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  });
}
