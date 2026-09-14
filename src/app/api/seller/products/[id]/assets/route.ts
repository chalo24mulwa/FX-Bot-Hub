import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, withAuthorization } from "@/lib/authorization";
import { assertSameOrigin } from "@/lib/security/csrf";
import {
  attachImage,
  attachScreenshot,
  attachDocumentation,
  attachProductFile,
  listProductAssets,
  AssetError,
} from "@/features/seller/asset-service";

const assetSchema = z.discriminatedUnion("assetType", [
  z.object({ assetType: z.literal("image"), storageKey: z.string().min(1), altText: z.string().optional() }),
  z.object({ assetType: z.literal("screenshot"), storageKey: z.string().min(1), caption: z.string().optional() }),
  z.object({
    assetType: z.literal("documentation"),
    title: z.string().min(1).max(160),
    contentMarkdown: z.string().optional(),
    storageKey: z.string().optional(),
  }),
  z.object({
    assetType: z.literal("file"),
    version: z.string().min(1).max(40),
    changelog: z.string().optional(),
    platform: z.enum(["MT4", "MT5", "MULTI_PLATFORM"]),
    fileName: z.string().min(1),
    storageKey: z.string().min(1),
    fileSizeBytes: z.number().int().positive(),
    checksumSha256: z.string().min(1),
  }),
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuthorization(async () => {
    const session = await requirePermission("product:edit_own");
    const { id } = await params;
    try {
      const assets = await listProductAssets(session.user.id, id);
      return NextResponse.json(assets);
    } catch (err) {
      if (err instanceof AssetError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuthorization(async () => {
    assertSameOrigin(request);
    const session = await requirePermission("product:edit_own");
    const { id } = await params;
    const body = assetSchema.parse(await request.json());

    try {
      switch (body.assetType) {
        case "image": {
          const row = await attachImage(session.user.id, id, body.storageKey, body.altText);
          return NextResponse.json(row, { status: 201 });
        }
        case "screenshot": {
          const row = await attachScreenshot(session.user.id, id, body.storageKey, body.caption);
          return NextResponse.json(row, { status: 201 });
        }
        case "documentation": {
          const row = await attachDocumentation(session.user.id, id, body);
          return NextResponse.json(row, { status: 201 });
        }
        case "file": {
          const row = await attachProductFile({ sellerId: session.user.id, productId: id, ...body });
          return NextResponse.json(row, { status: 201 });
        }
      }
    } catch (err) {
      if (err instanceof AssetError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  });
}
