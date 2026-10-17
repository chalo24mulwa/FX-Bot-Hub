import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readStorageToken } from "@/lib/storage/signed-token";
import { maxBytesForKey } from "@/lib/storage/object-serving";

// Receiving end of DatabaseStorageProvider's "presigned" upload URL (used only when no S3-compatible
// bucket is configured). Authorised by the HMAC token the presign route minted for exactly this key,
// content type and a few minutes of validity — same trust model as an S3 presigned PUT.
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const payload = readStorageToken(env.AUTH_SECRET, token, "u");
  if (!payload) return NextResponse.json({ error: "This upload link has expired. Please try again." }, { status: 403 });

  const limit = maxBytesForKey(payload.k);
  if (!limit) return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });

  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) {
    return NextResponse.json({ error: "File is too large." }, { status: 413 });
  }

  // Read the body with a hard byte cap: a client lying about (or omitting) Content-Length still can't
  // push more than the limit through.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return NextResponse.json({ error: "File is too large." }, { status: 413 });
    }
    chunks.push(value);
  }
  if (total === 0) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  const data = Buffer.concat(chunks, total);
  const contentType = payload.t ?? "application/octet-stream";
  await db.storedObject.upsert({
    where: { key: payload.k },
    create: { key: payload.k, contentType, sizeBytes: total, data },
    update: { contentType, sizeBytes: total, data },
  });
  return new NextResponse(null, { status: 200 });
}
