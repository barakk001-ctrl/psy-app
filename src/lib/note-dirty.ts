/**
 * Dirty-state rules for the session summary editor ("שינויים שלא נשמרו").
 *
 * The editor compares what is in the textarea with the last text the server
 * confirmed saving. Line endings are normalised first: a textarea reports
 * "\n" while a natively submitted form sends "\r\n", so the same text could
 * otherwise look changed.
 */
export function normalizeNoteText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function isNoteDirty(current: string, savedBaseline: string): boolean {
  return normalizeNoteText(current) !== normalizeNoteText(savedBaseline);
}

/**
 * The text the automatic sign-out may save on its own, or null to leave the
 * note alone: nothing changed, or the textarea was emptied — an empty save
 * deletes the note, which must never happen without her pressing save.
 */
export function noteDraftToKeep(current: string, savedBaseline: string): string | null {
  if (!isNoteDirty(current, savedBaseline)) return null;
  if (current.trim() === "") return null;
  return current;
}
