import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { checkEntitlement, recordDownload } from "@/features/downloads/entitlement-service";
import { checkSuspiciousDownloadPattern } from "@/lib/security/fraud";
import { storage } from "@/lib/storage";
import { clientIp } from "@/lib/security/rate-limit";

// Never serves a raw storage URL — always re-verifies entitlement per
// request and redirects to a short-lived signed URL, so a leaked link
// expires quickly and every download is attributable to a user.
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
      return NextResponse.json({ error: "File not found." }, { status: 404 });
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
      return NextResponse.json({ error: "You do not have access to this file." }, { status: 403 });
    }

    await recordDownload({
      userId: session.user.id,
      productId: product.id,
      productFileId: file.id,
      success: true,
      ipAddress,
      userAgent,
    });
    void checkSuspiciousDownloadPattern(session.user.id);

    const url = await storage.getSignedDownloadUrl(file.storageKey, 120);
    return NextResponse.redirect(url);
  });
}
