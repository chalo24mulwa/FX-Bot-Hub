export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
  /** Time-limited URL a browser can download or upload directly to. */
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
}
