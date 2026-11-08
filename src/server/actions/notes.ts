"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isReadOnly, subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";

import { decryptNote, encryptNote } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { noteSchema } from "@/server/validators/session";
import { NOTE_CONFLICT_ERROR, noteBaseMatches, noteVersion, parseNoteBase } from "@/lib/note-autosave";
import { formatTime } from "@/lib/format";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type NoteFormState = {
  error?: string;
  saved?: boolean;
  /** The note's version after this save ("" when there is no note now) */
  version?: string;
  /** "14:32", clinic time */
  savedAt?: string;
  /** Another tab or device saved the note meanwhile: nothing was written */
  conflict?: boolean;
  /** The version that is saved now, so the editor can overwrite it on purpose */
  currentVersion?: string;
} | null;

/**
 * Saves (or, when empty, deletes) a session's encrypted summary.
 *
 * `baseVersion` is the version the editor's text is based on (see
 * src/lib/note-autosave.ts): the write only happens while the note is still at
 * it, as one conditional statement, so an older tab can never overwrite a
 * newer save. `auto` marks the editor's automatic save, which doesn't refresh
 * the page (the editor keeps its own state, and a refresh would decrypt and
 * log the note again every minute).
 */
export async function saveNoteAction(
  _: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = noteSchema.safeParse({
    sessionId: formData.get("sessionId"),
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) {
    return { error: "תוכן לא תקין" };
  }
  const base = parseNoteBase(formData.get("baseVersion"));
  if (base.kind === "invalid") return { error: "תוכן לא תקין" };
  const auto = formData.get("auto") === "1";

  // Verify the session belongs to this user
  const session = await db.session.findFirst({
    where: { id: parsed.data.sessionId, userId },
    select: { id: true, clientId: true },
  });
  if (!session) {
    return { error: "פגישה לא נמצאה" };
  }

  const conflict = async (): Promise<NoteFormState> => {
    const now = await db.sessionNote.findUnique({
      where: { sessionId: session.id },
      select: { updatedAt: true },
    });
    return { error: NOTE_CONFLICT_ERROR, conflict: true, currentVersion: noteVersion(now?.updatedAt) };
  };
  const done = (version: string): NoteFormState => {
    if (!auto) revalidatePath(`/sessions/${session.id}`);
    return { saved: true, version, savedAt: formatTime(new Date()) };
  };

  // Empty content → delete any existing note (never sent by the automatic save)
  if (parsed.data.content.trim() === "") {
    const where =
      base.kind === "version"
        ? { sessionId: session.id, updatedAt: base.at }
        : { sessionId: session.id };
    if (base.kind === "none") {
      const existing = await db.sessionNote.findUnique({
        where: { sessionId: session.id },
        select: { updatedAt: true },
      });
      if (!noteBaseMatches(base, existing?.updatedAt ?? null)) return conflict();
      return done("");
    }
    const deleted = await db.sessionNote.deleteMany({ where });
    if (deleted.count > 0) {
      await logAudit(userId, "NOTE_DELETE", { sessionId: session.id, clientId: session.clientId });
    } else if (base.kind === "version") {
      // Changed meanwhile (a newer save is kept), or already gone (fine: it was to be emptied)
      const still = await db.sessionNote.findUnique({ where: { sessionId: session.id }, select: { id: true } });
      if (still) return conflict();
    }
    return done("");
  }

  const encrypted = encryptNote(parsed.data.content);
  const updatedAt = new Date();

  if (base.kind === "unchecked") {
    const note = await db.sessionNote.upsert({
      where: { sessionId: session.id },
      create: { sessionId: session.id, clientId: session.clientId, ...encrypted, updatedAt },
      update: { ...encrypted, updatedAt },
      select: { updatedAt: true },
    });
    await logAudit(userId, "NOTE_SAVE", { sessionId: session.id, clientId: session.clientId });
    return done(noteVersion(note.updatedAt));
  }

  if (base.kind === "none") {
    try {
      await db.sessionNote.create({
        data: { sessionId: session.id, clientId: session.clientId, ...encrypted, updatedAt },
      });
    } catch (err) {
      // P2002: another tab created the note first
      if ((err as { code?: string }).code === "P2002") return conflict();
      throw err;
    }
  } else {
    const written = await db.sessionNote.updateMany({
      where: { sessionId: session.id, updatedAt: base.at },
      data: { ...encrypted, updatedAt },
    });
    if (written.count === 0) return conflict();
  }
  await logAudit(userId, "NOTE_SAVE", { sessionId: session.id, clientId: session.clientId });
  return done(noteVersion(updatedAt));
}

/**
 * Appends imported message text to a session's encrypted note (creates the
 * note if none exists). Used by the message-import flow for post-meeting
 * summaries.
 */
export async function appendNoteToSessionAction(
  sessionId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { ok: false, error: READ_ONLY_ERROR };
  const content = text.trim().slice(0, 20000);
  if (!content) return { ok: false, error: "אין תוכן לשמירה" };

  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    include: { note: true },
  });
  if (!session) return { ok: false, error: "פגישה לא נמצאה" };

  let combined = content;
  if (session.note) {
    try {
      const existing = decryptNote({
        contentCiphertext: session.note.contentCiphertext,
        contentIv: session.note.contentIv,
        contentTag: session.note.contentTag,
      });
      if (existing.trim()) combined = `${existing}\n\n— הודעה מיובאת —\n${content}`;
    } catch {
      return { ok: false, error: "שגיאה בפענוח הסיכום הקיים" };
    }
  }

  const encrypted = encryptNote(combined);
  await db.sessionNote.upsert({
    where: { sessionId: session.id },
    create: { sessionId: session.id, clientId: session.clientId, ...encrypted },
    update: encrypted,
  });
  await logAudit(userId, "NOTE_APPEND", { sessionId: session.id, clientId: session.clientId });

  revalidatePath(`/sessions/${session.id}`);
  return { ok: true };
}
