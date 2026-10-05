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
