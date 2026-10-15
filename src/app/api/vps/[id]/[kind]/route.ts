import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/authorization/permissions";
import { loadAdminRoles } from "@/features/admin/impersonation-token";

// Serves a VPS provider's logo or cover photo from the database. A published provider's images are public;
// a draft or archived provider's are only served to an administrator who may manage VPS listings (so
// unpublished listings aren't leaked through an image URL). The type was fixed by magic bytes at upload; it
// is served with nosniff and never as anything but a raster image.

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{10,40}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!ID.test(id) || (kind !== "logo" && kind !== "cover")) return new NextResponse(null, { status: 404 });

  // Only the requested image's bytes are read (a logo request never loads the cover, and vice versa).
  let status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
  let data: Uint8Array | null = null;
  let mime: string | null = null;
  if (kind === "logo") {
    const r = await db.vpsProvider.findUnique({ where: { id }, select: { status: true, logoData: true, logoMime: true } });
    status = r?.status;
    data = r?.logoData ?? null;
    mime = r?.logoMime ?? null;
  } else {
    const r = await db.vpsProvider.findUnique({ where: { id }, select: { status: true, coverData: true, coverMime: true } });
    status = r?.status;
    data = r?.coverData ?? null;
    mime = r?.coverMime ?? null;
  }
  if (!status || !data || !mime) return new NextResponse(null, { status: 404 });

  const isPublic = status === "PUBLISHED";
  if (!isPublic) {
    const session = await auth();
    if (!session?.user || session.user.impersonation) return new NextResponse(null, { status: 404 });
    const adminRoles = await loadAdminRoles(session.user.id, session.user.role);
    if (!can({ role: session.user.role, adminRoles }, "vps:manage")) return new NextResponse(null, { status: 404 });
  }

  // `?v=<timestamp>` changes whenever the image does, so a versioned URL can be cached for a long time.
  const versioned = new URL(request.url).searchParams.has("v");
  return new NextResponse(Buffer.from(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": isPublic ? (versioned ? "public, max-age=31536000, immutable" : "public, max-age=300") : "private, no-store",
    },
  });
}
