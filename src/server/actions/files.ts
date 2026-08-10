"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptBuffer } from "@/lib/crypto";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type FileUploadState = {
  error?: string;
  uploaded?: boolean;
} | null;

export async function uploadSessionFileAction(
  _: FileUploadState,
  formData: FormData,
): Promise<FileUploadState> {
  const userId = await requireUserId();
  const sessionId = String(formData.get("sessionId") ?? "");
  const file = formData.get("file");

  if (!sessionId) return { error: "מזהה פגישה חסר" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "לא נבחר קובץ" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "הקובץ גדול מדי — עד 10MB" };
  }

  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) return { error: "פגישה לא נמצאה" };

  const data = Buffer.from(await file.arrayBuffer());
  const encrypted = encryptBuffer(data);

  await db.sessionFile.create({
    data: {
      userId,
      sessionId: session.id,
      clientId: session.clientId,
      fileName: file.name.slice(0, 200) || "קובץ",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataCiphertext: new Uint8Array(encrypted.ciphertext),
      dataIv: encrypted.iv,
      dataTag: encrypted.tag,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/clients/${session.clientId}`);
  return { uploaded: true };
}

export async function deleteSessionFileAction(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const file = await db.sessionFile.findFirst({
    where: { id, userId },
    select: { id: true, sessionId: true, clientId: true },
  });
  if (!file) return;

  await db.sessionFile.delete({ where: { id: file.id } });
  revalidatePath(`/sessions/${file.sessionId}`);
  revalidatePath(`/clients/${file.clientId}`);
}
