import type { UploadKind } from "./validate-upload";

// Single definition of where a product's uploads live in object storage, so
// the presign step (which mints keys) and the attach step (which must only
// accept keys the presign step could have minted) can't drift apart.
export function productKeyPrefix(productId: string, kind: UploadKind): string {
  return `products/${productId}/${kind}/`;
}

/** True only for a key under this product's own folder for the given upload kind. */
export function isProductKey(productId: string, kind: UploadKind, storageKey: string): boolean {
  // Reject path tricks even though object stores treat keys as opaque strings —
  // a stored key later feeds a delete, and "products/<id>/image/../../x" is
  // never something the presign step produces (file names are sanitized).
  if (storageKey.includes("..")) return false;
  return storageKey.startsWith(productKeyPrefix(productId, kind)) && storageKey.length > productKeyPrefix(productId, kind).length;
}
