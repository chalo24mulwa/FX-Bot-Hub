export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | null;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
  /** Size/type of a stored object, or null if it doesn't exist. Used to verify a client-reported upload before referencing it. */
  headObject(key: string): Promise<ObjectInfo | null>;
  /** Time-limited URL a browser can download or upload directly to. */
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
}
