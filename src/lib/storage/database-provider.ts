import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createStorageToken } from "./signed-token";
import type { ObjectInfo, PutObjectInput, StorageProvider } from "./types";

/**
 * Stores file bytes in Postgres (`StoredObject`) for deployments with no object storage. Same
 * interface and same keys as the S3 provider; "signed URLs" are same-origin routes carrying an
 * HMAC token (see signed-token.ts), so nothing outside this class knows which backend is in use.
 */
export class DatabaseStorageProvider implements StorageProvider {
  async putObject({ key, body, contentType }: PutObjectInput): Promise<void> {
    const data = Buffer.from(body as Uint8Array);
    await db.storedObject.upsert({
      where: { key },
      create: { key, contentType, sizeBytes: data.length, data },
      update: { contentType, sizeBytes: data.length, data },
    });
  }

  async deleteObject(key: string): Promise<void> {
    await db.storedObject.deleteMany({ where: { key } });
  }

  async headObject(key: string): Promise<ObjectInfo | null> {
    const row = await db.storedObject.findUnique({ where: { key }, select: { sizeBytes: true, contentType: true } });
    return row ? { sizeBytes: row.sizeBytes, contentType: row.contentType } : null;
  }

  async readObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const row = await db.storedObject.findUnique({ where: { key }, select: { data: true, contentType: true } });
    return row ? { data: Buffer.from(row.data), contentType: row.contentType } : null;
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const token = createStorageToken(env.AUTH_SECRET, { m: "d", k: key, e: Math.floor(Date.now() / 1000) + expiresInSeconds });
    return `/api/storage/download?token=${token}`;
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
    const token = createStorageToken(env.AUTH_SECRET, { m: "u", k: key, t: contentType, e: Math.floor(Date.now() / 1000) + expiresInSeconds });
    return `/api/storage/upload?token=${token}`;
  }
}
