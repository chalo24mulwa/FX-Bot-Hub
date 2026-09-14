import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listProductsQuerySchema, createProductSchema } from "@/lib/validations/product";
import { listPublishedProducts, createDraftProduct } from "@/server/services/product-service";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  const query = listProductsQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  const result = await listPublishedProducts(query);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
