"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import {
  checkDocument,
  cleanDescription,
  renamedFileName,
  type DocumentCategory,
} from "@/lib/client-documents";
import { saveDocumentBytes } from "@/lib/document-storage";
import { documentStore } from "@/lib/document-storage-pg";
import { documentUpdateSchema, documentUploadSchema } from "@/server/validators/document";

// Documents uploaded to a client's file ("מסמכים" on the client card). The
// browser sends one file per call (a batch is a loop), so a refused file never
// takes the others down and each request stays under the body limit.

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type DocumentActionResult = { ok: true } | { error: string };

/** What the card shows for a document (names decrypted). */
export type ClientDocumentView = {
  id: string;
  name: string;
  description: string | null;
  category: DocumentCategory | null;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type DocumentSaveResult = { ok: true; document: ClientDocumentView } | { error: string };

export async function uploadClientDocumentAction(formData: FormData): Promise<DocumentSaveResult> {
  const userId = await requireUserId();
  const parsed = documentUploadSchema.safeParse({
    clientId: formData.get("clientId") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "לא נבחר קובץ" };

  const client = await db.client.findFirst({
    where: { id: parsed.data.clientId, userId },
    select: { id: true },
  });
  if (!client) return { error: "הלקוח/ה לא נמצא/ה" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkDocument({ name: file.name, size: file.size }, bytes);
  if (!check.ok) return { error: check.error };

  const description = cleanDescription(parsed.data.description);
  const doc = await db.clientDocument.create({
    data: {
      userId,
      clientId: client.id,
      nameCiphertext: encryptSecret(check.name),
      descriptionCiphertext: description ? encryptSecret(description) : null,
      category: parsed.data.category,
      mimeType: check.mimeType,
      size: bytes.length,
    },
    select: { id: true, createdAt: true },
  });
  try {
    await saveDocumentBytes(documentStore, doc.id, bytes);
  } catch (err) {
    // Never leave a document row without its bytes
    await db.clientDocument.deleteMany({ where: { id: doc.id, userId } }).catch(() => {});
    console.error("Document upload failed:", err instanceof Error ? err.message : err);
    return { error: "שמירת הקובץ נכשלה — נסו שוב" };
  }

  await logAudit(userId, "DOCUMENT_UPLOAD", { clientId: client.id, documentId: doc.id });
  revalidatePath(`/clients/${client.id}`);
  return {
    ok: true,
    document: {
      id: doc.id,
      name: check.name,
      description,
      category: parsed.data.category,
      mimeType: check.mimeType,
      size: bytes.length,
      createdAt: doc.createdAt.toISOString(),
    },
  };
}

export async function updateClientDocumentAction(formData: FormData): Promise<DocumentSaveResult> {
  const userId = await requireUserId();
  const parsed = documentUpdateSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const doc = await db.clientDocument.findFirst({
    where: { id: parsed.data.id, userId },
    select: { id: true, clientId: true, nameCiphertext: true, mimeType: true, size: true, createdAt: true },
  });
  if (!doc) return { error: "המסמך לא נמצא" };

  let currentName: string;
  try {
    currentName = decryptSecret(doc.nameCiphertext);
  } catch {
    return { error: "שגיאה בפענוח פרטי המסמך" };
  }
  const name = renamedFileName(parsed.data.name, currentName);
  if (!name) return { error: "נא לכתוב שם לקובץ" };
  const description = cleanDescription(parsed.data.description);

  await db.clientDocument.updateMany({
    where: { id: doc.id, userId },
    data: {
      nameCiphertext: encryptSecret(name),
      descriptionCiphertext: description ? encryptSecret(description) : null,
      category: parsed.data.category,
    },
  });
  await logAudit(userId, "DOCUMENT_UPDATE", { clientId: doc.clientId, documentId: doc.id });
  revalidatePath(`/clients/${doc.clientId}`);
  return {
    ok: true,
    document: {
      id: doc.id,
      name,
      description,
      category: parsed.data.category,
      mimeType: doc.mimeType,
      size: doc.size,
      createdAt: doc.createdAt.toISOString(),
    },
  };
}

export async function deleteClientDocumentAction(formData: FormData): Promise<DocumentActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "מזהה מסמך חסר" };
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const doc = await db.clientDocument.findFirst({
    where: { id, userId },
    select: { id: true, clientId: true },
  });
  if (!doc) return { error: "המסמך לא נמצא" };

  // The bytes first (an object-store backend has no cascade), then the row
  await documentStore.delete(doc.id);
  await db.clientDocument.deleteMany({ where: { id: doc.id, userId } });
  await logAudit(userId, "DOCUMENT_DELETE", { clientId: doc.clientId, documentId: doc.id });
  revalidatePath(`/clients/${doc.clientId}`);
  return { ok: true };
}
