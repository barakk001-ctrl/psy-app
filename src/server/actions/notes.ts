"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptNote } from "@/lib/crypto";
import { noteSchema } from "@/server/validators/session";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type NoteFormState = {
  error?: string;
  saved?: boolean;
} | null;

export async function saveNoteAction(
  _: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const userId = await requireUserId();

  const parsed = noteSchema.safeParse({
    sessionId: formData.get("sessionId"),
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) {
    return { error: "תוכן לא תקין" };
  }

  // Verify the session belongs to this user
  const session = await db.session.findFirst({
    where: { id: parsed.data.sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) {
    return { error: "פגישה לא נמצאה" };
  }

  // Empty content → delete any existing note
  if (parsed.data.content.trim() === "") {
    await db.sessionNote.deleteMany({ where: { sessionId: session.id } });
    revalidatePath(`/sessions/${session.id}`);
    return { saved: true };
  }

  const encrypted = encryptNote(parsed.data.content);

  await db.sessionNote.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      clientId: session.clientId,
      ...encrypted,
    },
    update: encrypted,
  });

  revalidatePath(`/sessions/${session.id}`);
  return { saved: true };
}
