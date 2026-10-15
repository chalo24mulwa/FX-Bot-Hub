import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/authorization/permissions";
import { loadAdminRoles } from "@/features/admin/impersonation-token";

// Serves a broker's logo from the database. A published broker's logo is public; a draft or archived
// broker's logo is only served to an administrator who may manage brokers (so unpublished listings
// aren't leaked through their image URL). The type was fixed by magic bytes at upload; it is served
// with nosniff and never as anything but a raster image.

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{10,40}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) return new NextResponse(null, { status: 404 });

  const broker = await db.broker.findUnique({ where: { id }, select: { status: true, logoData: true, logoMime: true, logoUpdatedAt: true } });
  if (!broker?.logoData || !broker.logoMime) return new NextResponse(null, { status: 404 });

  const isPublic = broker.status === "PUBLISHED";
  if (!isPublic) {
    const session = await auth();
    if (!session?.user || session.user.impersonation) return new NextResponse(null, { status: 404 });
    const adminRoles = await loadAdminRoles(session.user.id, session.user.role);
    if (!can({ role: session.user.role, adminRoles }, "broker:manage")) return new NextResponse(null, { status: 404 });
  }

  // `?v=<timestamp>` changes whenever the logo does, so a versioned URL can be cached for a long time.
  const versioned = new URL(request.url).searchParams.has("v");
  return new NextResponse(Buffer.from(broker.logoData), {
    headers: {
      "Content-Type": broker.logoMime,
      "Content-Length": String(broker.logoData.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": isPublic ? (versioned ? "public, max-age=31536000, immutable" : "public, max-age=300") : "private, no-store",
    },
  });
}
