import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { PutObjectInput, StorageProvider } from "./types";

// Works against AWS S3 or any S3-compatible service (Cloudflare R2, MinIO,
// Backblaze B2, DigitalOcean Spaces) by pointing STORAGE_ENDPOINT at it.
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      // Recent AWS SDK v3 releases default to computing a CRC32 checksum for
      // every PutObject — and for a *presigned* PUT (which has no body at
      // signing time) that bakes the checksum of an empty payload
      // (`x-amz-checksum-crc32=AAAAAA==`) into the URL. The browser then
      // uploads a real file, S3/R2 compare its checksum to the signed empty
      // one, and reject the upload. Direct-to-storage uploads (seller cover
      // photos, screenshots, product files) all depend on presigned PUTs, so
      // only compute checksums where an operation actually requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials:
        env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.STORAGE_ACCESS_KEY_ID,
              secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async putObject({ key, body, contentType }: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 300
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds }
    );
  }
}
