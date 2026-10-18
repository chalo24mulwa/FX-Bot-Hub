import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentDisposition, downloadFileName, isPubliclyReadableKey, publicDelivery } from "@/lib/storage/object-serving";

// Public-read for images and documentation kept in the database (no bucket configured). Product files
// are never served here — only through the entitlement-checked signed download.
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!isPubliclyReadableKey(key)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const row = await db.storedObject.findUnique({ where: { key }, select: { data: true, sizeBytes: true } });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { contentType, inline } = publicDelivery(key);
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", downloadFileName(key)),
      // Keys contain a random id and never change content, so they can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self'",
    },
  });
}
