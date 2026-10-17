import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readStorageToken } from "@/lib/storage/signed-token";
import { contentDisposition, downloadFileName } from "@/lib/storage/object-serving";

// Target of DatabaseStorageProvider.getSignedDownloadUrl(). Entitlement was already checked by
// /api/downloads/[id], which minted this short-lived token; the response is always an opaque attachment.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = readStorageToken(env.AUTH_SECRET, request.nextUrl.searchParams.get("token") ?? "", "d");
  if (!payload) return NextResponse.json({ error: "This download link has expired." }, { status: 403 });

  const row = await db.storedObject.findUnique({ where: { key: payload.k }, select: { data: true, sizeBytes: true } });
  if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(row.sizeBytes),
      "Content-Disposition": contentDisposition("attachment", downloadFileName(payload.k)),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
