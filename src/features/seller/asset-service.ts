import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { storage, validateUpload, type UploadKind } from "@/lib/storage";
import { notifyNewVersion } from "@/features/favorites/notify-favoriters";

export class AssetError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertOwnedDraftOrRejected(sellerId: string, productId: string) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || product.sellerId !== sellerId) {
    throw new AssetError("Product not found.", 404);
  }
  return product;
}

export interface PresignInput {
  sellerId: string;
  productId: string;
  kind: UploadKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export async function presignProductUpload({
  sellerId,
  productId,
  kind,
  fileName,
  contentType,
  sizeBytes,
}: PresignInput) {
  await assertOwnedDraftOrRejected(sellerId, productId);

  const result = validateUpload({ kind, fileName, contentType, sizeBytes });
  if (!result.ok) throw new AssetError(result.error!, 422);

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `products/${productId}/${kind}/${randomUUID()}-${safeName}`;
  const uploadUrl = await storage.getSignedUploadUrl(storageKey, contentType, 300);

  return { uploadUrl, storageKey };
}

export async function attachImage(sellerId: string, productId: string, storageKey: string, altText?: string) {
  await assertOwnedDraftOrRejected(sellerId, productId);
  const count = await db.productImage.count({ where: { productId } });
  return db.productImage.create({ data: { productId, storageKey, altText, position: count } });
}

export async function attachScreenshot(sellerId: string, productId: string, storageKey: string, caption?: string) {
  await assertOwnedDraftOrRejected(sellerId, productId);
  const count = await db.productScreenshot.count({ where: { productId } });
  return db.productScreenshot.create({ data: { productId, storageKey, caption, position: count } });
}

export async function attachDocumentation(
  sellerId: string,
  productId: string,
  input: { title: string; contentMarkdown?: string; storageKey?: string }
) {
  await assertOwnedDraftOrRejected(sellerId, productId);
  const count = await db.productDocumentation.count({ where: { productId } });
  return db.productDocumentation.create({
    data: { productId, position: count, ...input },
  });
}

export interface AttachFileInput {
  sellerId: string;
  productId: string;
  version: string;
  changelog?: string;
  platform: "MT4" | "MT5" | "MULTI_PLATFORM";
  fileName: string;
  storageKey: string;
  fileSizeBytes: number;
  checksumSha256: string;
}

// Creates the ProductVersion on first use of a given version string, then
// attaches the file to it — a version can carry more than one file (e.g.
// separate MT4/MT5 builds).
export async function attachProductFile(input: AttachFileInput) {
  const product = await assertOwnedDraftOrRejected(input.sellerId, input.productId);

  const existing = await db.productVersion.findUnique({
    where: { productId_version: { productId: input.productId, version: input.version } },
  });

  const productVersion = existing
    ? await db.productVersion.update({
        where: { id: existing.id },
        data: { changelog: input.changelog },
      })
    : await db.productVersion.create({
        data: { productId: input.productId, version: input.version, changelog: input.changelog },
      });

  if (!existing && product.status === "PUBLISHED") {
    void notifyNewVersion(product.id, product.name, product.slug, input.version);
  }

  return db.productFile.create({
    data: {
      productVersionId: productVersion.id,
      platform: input.platform,
      fileName: input.fileName,
      storageKey: input.storageKey,
      fileSizeBytes: input.fileSizeBytes,
      checksumSha256: input.checksumSha256,
    },
  });
}

export async function listProductAssets(sellerId: string, productId: string) {
  await assertOwnedDraftOrRejected(sellerId, productId);
  const [images, screenshots, documentation, versions] = await Promise.all([
    db.productImage.findMany({ where: { productId }, orderBy: { position: "asc" } }),
    db.productScreenshot.findMany({ where: { productId }, orderBy: { position: "asc" } }),
    db.productDocumentation.findMany({ where: { productId }, orderBy: { position: "asc" } }),
    db.productVersion.findMany({ where: { productId }, orderBy: { createdAt: "desc" }, include: { files: true } }),
  ]);
  return { images, screenshots, documentation, versions };
}
