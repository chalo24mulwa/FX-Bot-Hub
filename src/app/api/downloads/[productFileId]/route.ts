import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { checkEntitlement, recordDownload } from "@/features/downloads/entitlement-service";
import { checkSuspiciousDownloadPattern } from "@/lib/security/fraud";
import { storage } from "@/lib/storage";
import { clientIp } from "@/lib/security/rate-limit";
import { contentDisposition } from "@/lib/storage/object-serving";

// Never serves a raw storage URL — always re-verifies entitlement per request, so every download is attributable to a user.
//
// Two delivery modes, same entitlement check:
//  - Database storage (no bucket configured, e.g. today's production): the file is returned by THIS response, as an attachment. There is
//    no second hop and no token a proxy or CDN could cache and replay after it expires.
//  - A bucket (S3/R2/MinIO): redirect to a short-lived signed URL.
// Every response is `private, no-store`: it is per-user and must never be stored by a CDN or the browser.
const NO_STORE = { "Cache-Control": "private, no-store, no-transform" } as const;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productFileId: string }> }
) {
  return withAuthorization(async () => {
    const session = await requireSession();
    const { productFileId } = await params;
    const ipAddress = clientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const file = await db.productFile.findUnique({
      where: { id: productFileId },
      include: { productVersion: { include: { product: true } } },
    });
    if (!file) {
      return fail("File not found.", 404);
    }

    const product = file.productVersion.product;
    const entitlement = await checkEntitlement(session.user.id, session.user.role, product.id);
    if (!entitlement.entitled) {
      await recordDownload({
        userId: session.user.id,
        productId: product.id,
        productFileId: file.id,
        success: false,
        ipAddress,
        userAgent,
      });
      return fail("You do not have access to this file.", 403);
    }

    // The access record is bookkeeping: the buyer is not made to wait for it (nor does a failure to write it stop their download).
    void recordDownload({
      userId: session.user.id,
      productId: product.id,
      productFileId: file.id,
      success: true,
      ipAddress,
      userAgent,
    }).catch(() => undefined);
    void checkSuspiciousDownloadPattern(session.user.id);

    if (storage.readObject) {
      const object = await storage.readObject(file.storageKey);
      if (!object) return fail("This file is no longer available. Please contact the seller.", 404);
      return new NextResponse(new Uint8Array(object.data), {
        headers: {
          ...NO_STORE,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": contentDisposition("attachment", file.fileName),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const url = await storage.getSignedDownloadUrl(file.storageKey, 120);
    const response = NextResponse.redirect(new URL(url, request.url));
    response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return response;
  });
}
