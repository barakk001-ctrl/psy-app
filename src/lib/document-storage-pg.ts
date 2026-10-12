// The Postgres backend of document-storage.ts: encrypted bytes in
// ClientDocumentBlob (bytea), a table of their own so listing a client's
// documents never reads them.

import { db } from "@/lib/db";
import type { DocumentBlobStore } from "@/lib/document-storage";

export const postgresBlobStore: DocumentBlobStore = {
  async put(documentId, blob) {
    await db.clientDocumentBlob.upsert({
      where: { documentId },
      create: { documentId, ciphertext: new Uint8Array(blob.ciphertext), iv: blob.iv, tag: blob.tag },
      update: { ciphertext: new Uint8Array(blob.ciphertext), iv: blob.iv, tag: blob.tag },
    });
  },
  async get(documentId) {
    const row = await db.clientDocumentBlob.findUnique({ where: { documentId } });
    return row ? { ciphertext: Buffer.from(row.ciphertext), iv: row.iv, tag: row.tag } : null;
  },
  async delete(documentId) {
    await db.clientDocumentBlob.deleteMany({ where: { documentId } });
  },
};

/** The store the app uses. Swap here to move documents to another backend. */
export const documentStore: DocumentBlobStore = postgresBlobStore;
