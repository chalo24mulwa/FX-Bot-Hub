import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { presignProductUpload, AssetError } from "@/features/seller/asset-service";

const bodySchema = z.object({
  productId: z.string().cuid(),
  kind: z.enum(["productFile", "image", "documentation"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requirePermission("product:edit_own");

    const body = bodySchema.parse(await request.json());
    try {
      const result = await presignProductUpload({ sellerId: session.user.id, ...body });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof AssetError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  });
}
