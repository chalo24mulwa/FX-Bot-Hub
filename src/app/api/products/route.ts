import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { listProductsQuerySchema, createProductSchema } from "@/lib/validations/product";
import { listPublishedProducts, createDraftProduct } from "@/server/services/product-service";
import { requirePermission, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  const query = listProductsQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  const result = await listPublishedProducts(query);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requirePermission("product:create");

    try {
      const body = createProductSchema.parse(await request.json());
      const product = await createDraftProduct(session.user.id, body);
      return NextResponse.json(product, { status: 201 });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.flatten() }, { status: 400 });
      }
      throw err;
    }
  });
}
