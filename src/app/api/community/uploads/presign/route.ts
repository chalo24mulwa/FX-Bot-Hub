import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { storage, validateUpload } from "@/lib/storage";
import { communityKeyPrefix } from "@/lib/community/misc";
import { CommunityError, requireCapability } from "@/features/community/core";

const bodySchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

// Presigned upload for a Community chart/screenshot. Same direct-to-storage
// flow as product images: the server never receives the bytes. It only mints
// a short-lived PUT URL for a key inside the member's OWN folder, after
// checking the member may post and the file passes the image allowlist
// (extension + MIME + 8 MB) — no executables, no SVG (script-capable).
export async function POST(request: NextRequest) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await checkRateLimit(session.user.id, { bucket: "community:upload", limit: 30, windowSeconds: 3600 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });

    try {
      await requireCapability(session.user.id, "canPost");
    } catch (err) {
      if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }

    const { fileName, contentType, sizeBytes } = parsed.data;
    const check = validateUpload({ kind: "image", fileName, contentType, sizeBytes });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const storageKey = `${communityKeyPrefix(session.user.id)}${randomUUID()}-${safeName}`;
    try {
      const uploadUrl = await storage.getSignedUploadUrl(storageKey, contentType, 300);
      return NextResponse.json({ uploadUrl, storageKey });
    } catch {
      return NextResponse.json({ error: "Image uploads aren't available right now." }, { status: 503 });
    }
  });
}
