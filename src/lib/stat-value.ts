/**
 * Sizing rules for the big number on a stat card (dashboard / reports).
 *
 * On a phone the dashboard shows two cards per row, so a card is only ~130px
 * wide inside its padding — too narrow for "‏22,900.00 ‏₪" at the desktop
 * size. Two things keep any amount on one line, all the way down to 360px:
 *  1. A whole-shekel amount drops its ".00" on phones (no information lost).
 *  2. The font shrinks to fit the card width (CSS `cqi` units), never growing
 *     past the desktop size, so short values like "4" stay big.
 * Desktop (lg+) keeps the fixed desktop size.
 */

/** Approximate advance widths in em for the display font (Rubik), rounded up. */
const CHAR_EM: Record<string, number> = {
  ",": 0.3,
  ".": 0.3,
  " ": 0.3,
  " ": 0.3,
  "₪": 0.85,
  "-": 0.45,
  "‏": 0, // RLM — zero-width bidi mark Intl adds for he-IL
  "‎": 0, // LRM
};
const DEFAULT_CHAR_EM = 0.62; // digits and anything else

/** Estimated rendered width of `text` in em. */
export function estimateTextEm(text: string): number {
  let em = 0;
  for (const ch of text) em += CHAR_EM[ch] ?? DEFAULT_CHAR_EM;
  return em;
}

/**
 * Font size, in `cqi` (percent of the card's content width), at which `text`
 * fits on one line with a little slack. Callers cap it at the desktop size.
 */
export function fitCqi(text: string): number {
  const em = estimateTextEm(text);
  if (em <= 0) return 100;
  return Math.floor((100 / (em * 1.1)) * 10) / 10;
}

/**
 * Splits a formatted amount whose agorot are exactly zero ("‏22,900.00 ‏₪")
 * into the whole part, the ".00" and the currency suffix, so the ".00" can be
 * hidden on narrow screens. Returns null for anything else (plain counts,
 * amounts with real agorot like "‏120.50 ‏₪").
 */
export function splitZeroDecimals(
  text: string,
): { whole: string; decimals: string; suffix: string } | null {
  const m = /^(.*\d)(\.00)(\D*)$/.exec(text);
  if (!m) return null;
  return { whole: m[1], decimals: m[2], suffix: m[3] };
}
