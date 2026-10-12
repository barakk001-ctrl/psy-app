// Where the bytes of client documents live — behind a small put/get/delete
// interface, so they can move from Postgres to an object store (e.g.
// Cloudflare R2 in the EU) when the app hosts many practices.
//
// The store only ever sees ciphertext: encryption happens here, above it
// (AES-256-GCM with NOTES_ENCRYPTION_KEY, the same as notes), so a new backend
// never holds readable files. Keys are ClientDocument ids — never guessable
// paths, and never served directly: every read goes through the owner check
// in client-document-serve.ts.
//
// Today's backend is Postgres (`postgresBlobStore`, document-storage-pg.ts):
// one ClientDocumentBlob row per document, deleted by ON DELETE CASCADE with
// its document and so with the client (recycle-bin purge). An object-store
// backend would have no cascade: purging a client would then have to call
// `delete` for each of their documents first.

import { decryptBuffer, encryptBuffer } from "@/lib/crypto";

export type EncryptedBlob = { ciphertext: Buffer; iv: string; tag: string };

export interface DocumentBlobStore {
  put(documentId: string, blob: EncryptedBlob): Promise<void>;
  /** null = no bytes stored under this id. */
  get(documentId: string): Promise<EncryptedBlob | null>;
  /** Removing what isn't there is not an error. */
  delete(documentId: string): Promise<void>;
}

/** Encrypts the file and stores it. */
export async function saveDocumentBytes(
  store: DocumentBlobStore,
  documentId: string,
  bytes: Buffer,
): Promise<void> {
  await store.put(documentId, encryptBuffer(bytes));
}

/** The decrypted file, or null if nothing is stored. Throws if it was tampered with. */
export async function loadDocumentBytes(
  store: DocumentBlobStore,
  documentId: string,
): Promise<Buffer | null> {
  const blob = await store.get(documentId);
  return blob ? decryptBuffer(blob) : null;
}

/** In-memory store — for tests. */
export function memoryBlobStore(): DocumentBlobStore & { size(): number } {
  const blobs = new Map<string, EncryptedBlob>();
  return {
    async put(id, blob) {
      blobs.set(id, { ciphertext: Buffer.from(blob.ciphertext), iv: blob.iv, tag: blob.tag });
    },
    async get(id) {
      return blobs.get(id) ?? null;
    },
    async delete(id) {
      blobs.delete(id);
    },
    size: () => blobs.size,
  };
}
