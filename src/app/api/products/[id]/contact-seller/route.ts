import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";

const bodySchema = z.object({ message: z.string().min(5).max(2000) });

// Keeps the seller's email private: the buyer's message becomes an in-app
// Notification (+ email relay) rather than exposing a mailto link.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await checkRateLimit(clientIp(request), { bucket: "contact-seller", limit: 10, windowSeconds: 3600 });

    const { id } = await params;
    const { message } = bodySchema.parse(await request.json());

    const product = await db.product.findUnique({
      where: { id },
      select: { name: true, sellerId: true, slug: true, seller: { select: { email: true } } },
    });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    await createNotification({
      userId: product.sellerId,
      type: "GENERAL",
      title: `Message about "${product.name}"`,
      body: `From ${session.user.email}: ${message}`,
      link: `/marketplace/${product.slug}`,
    });

    void enqueueEmail(product.seller.email, {
      subject: `New message about "${product.name}"`,
      html: `<p>From ${session.user.email}:</p><p>${message}</p>`,
      text: `From ${session.user.email}: ${message}`,
    });

    return NextResponse.json({ ok: true });
  });
}
