import { NextRequest, NextResponse } from "next/server";
import { getPublishedProductBySlug } from "@/server/services/product-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}
