// Serving a client document (GET /api/documents/[id]) — the owner check,
// decryption, headers and access log in one testable function. The route
// passes the real database, store and logger; tests pass fakes.

import type { AuditAction } from "@/lib/audit";
import { documentResponseHeaders } from "@/lib/client-documents";
import { loadDocumentBytes, type DocumentBlobStore } from "@/lib/document-storage";

export type ServableDocument = {
  id: string;
  clientId: string;
  nameCiphertext: string;
  mimeType: string;
};

export type ServeDeps = {
  /** Must match on BOTH id and owner — the whole authorization model. */
  findDocument(where: { id: string; userId: string }): Promise<ServableDocument | null>;
  store: DocumentBlobStore;
  decryptName(packed: string): string;
  audit(
    userId: string,
    action: AuditAction,
    ids: { clientId?: string; documentId?: string },
  ): Promise<void>;
};

export type ServeResult = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array<ArrayBuffer> | string;
};

const PLAIN = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function serveClientDocument(
  userId: string | null | undefined,
  documentId: string,
  mode: "view" | "download",
  deps: ServeDeps,
): Promise<ServeResult> {
  if (!userId) return { status: 401, headers: PLAIN, body: "Unauthorized" };
  // Someone else's document answers exactly like a missing one
  const doc = documentId ? await deps.findDocument({ id: documentId, userId }) : null;
  if (!doc) return { status: 404, headers: PLAIN, body: "Not found" };

  let bytes: Buffer | null;
  let fileName: string;
  try {
    bytes = await loadDocumentBytes(deps.store, doc.id);
    fileName = deps.decryptName(doc.nameCiphertext);
  } catch {
    return { status: 500, headers: PLAIN, body: "Decryption failed" };
  }
  if (!bytes) return { status: 404, headers: PLAIN, body: "Not found" };

  await deps.audit(userId, mode === "view" ? "DOCUMENT_VIEW" : "DOCUMENT_DOWNLOAD", {
    clientId: doc.clientId,
    documentId: doc.id,
  });

  return {
    status: 200,
    headers: documentResponseHeaders(
      { fileName, mimeType: doc.mimeType, size: bytes.length },
      mode === "view",
    ),
    body: new Uint8Array(bytes),
  };
}
