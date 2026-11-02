// The encrypted bytes of expense files: the same store interface and encryption
// as client documents (document-storage.ts), in a table of their own. Deleted
// with the expense, and so with a closed account.

import { db } from "@/lib/db";
import type { DocumentBlobStore } from "@/lib/document-storage";

export const expenseStore: DocumentBlobStore = {
  async put(expenseId, blob) {
    await db.expenseBlob.upsert({
      where: { expenseId },
      create: { expenseId, ciphertext: new Uint8Array(blob.ciphertext), iv: blob.iv, tag: blob.tag },
      update: { ciphertext: new Uint8Array(blob.ciphertext), iv: blob.iv, tag: blob.tag },
    });
  },
  async get(expenseId) {
    const row = await db.expenseBlob.findUnique({ where: { expenseId } });
    return row ? { ciphertext: Buffer.from(row.ciphertext), iv: row.iv, tag: row.tag } : null;
  },
  async delete(expenseId) {
    await db.expenseBlob.deleteMany({ where: { expenseId } });
  },
};
