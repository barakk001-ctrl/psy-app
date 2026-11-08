// Automatic saving of the session summary (NoteEditor), and the version check
// that keeps one tab or device from overwriting a newer save with older text.
//
// The editor remembers the version of the note its text is based on (the
// note's updatedAt, or "" when there was no note) and sends it with every
// save. The server writes only if the note is still at that version; otherwise
// nothing is written and the editor says so and stops saving on its own.

/** First automatic save this long after the text starts to differ from the saved one. */
export const AUTOSAVE_AFTER_MS = 60_000;
/** After a failed automatic save, wait this long before trying again. */
export const AUTOSAVE_RETRY_MS = 30_000;
/** How often the editor checks whether a save is due. */
export const AUTOSAVE_TICK_MS = 5_000;

export type AutosaveState = {
  /** When the text first differed from the last saved text (null: nothing unsaved) */
  dirtySince: number | null;
  /** A save is on its way */
  saving: boolean;
  /** Never on its own: another version was saved meanwhile, or the note couldn't be read */
  blocked: boolean;
  /** When the last attempt failed (null: it didn't) */
  failedAt: number | null;
};

/** Whether the editor should save on its own now. */
export function autosaveDue(s: AutosaveState, now: number): boolean {
  if (s.dirtySince === null || s.saving || s.blocked) return false;
  if (s.failedAt !== null && now - s.failedAt < AUTOSAVE_RETRY_MS) return false;
  return now - s.dirtySince >= AUTOSAVE_AFTER_MS;
}

/** The version string of a note: its updatedAt, or "" when there is no note. */
export function noteVersion(updatedAt: Date | null | undefined): string {
  return updatedAt ? updatedAt.toISOString() : "";
}

/**
 * What the editor said its text is based on.
 * - unchecked: nothing was sent (an older page): the save goes through, as before
 * - none: there was no note
 * - version: the note as it was saved at `at`
 * - invalid: something that isn't a version: refuse rather than guess
 */
export type NoteBase =
  | { kind: "unchecked" }
  | { kind: "none" }
  | { kind: "version"; at: Date }
  | { kind: "invalid" };

export function parseNoteBase(raw: unknown): NoteBase {
  if (raw === null || raw === undefined) return { kind: "unchecked" };
  if (typeof raw !== "string") return { kind: "invalid" };
  if (raw === "") return { kind: "none" };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(raw)) return { kind: "invalid" };
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? { kind: "invalid" } : { kind: "version", at };
}

/** Whether a save based on `base` may replace the note as it is now (`current`: its updatedAt, or null). */
export function noteBaseMatches(base: NoteBase, current: Date | null): boolean {
  switch (base.kind) {
    case "unchecked":
      return true;
    case "none":
      return current === null;
    case "version":
      return current !== null && current.getTime() === base.at.getTime();
    case "invalid":
      return false;
  }
}

export const NOTE_CONFLICT_ERROR =
  "הסיכום נשמר בינתיים בחלון או במכשיר אחר, ולכן הטקסט כאן לא נשמר כדי לא לדרוס אותו.";
