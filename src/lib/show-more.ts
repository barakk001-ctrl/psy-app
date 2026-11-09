// "הצגת עוד" / "הצגת פחות" on a list that starts short (ShowMoreList): the
// client card's summaries and upcoming meetings, the access log in Settings.

/** A toggle only when there is something hidden. */
export function needsShowMore(total: number, initial: number): boolean {
  return total > Math.max(0, initial);
}

/** How many rows are shown. */
export function shownCount(total: number, initial: number, expanded: boolean): number {
  return expanded ? total : Math.min(total, Math.max(0, initial));
}

/** The toggle's label (a noun, like the app's other buttons). */
export function showMoreLabel(expanded: boolean): string {
  return expanded ? "הצגת פחות" : "הצגת עוד";
}
