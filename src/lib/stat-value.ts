/**
 * Sizing rules for the big number on a stat card (dashboard / reports).
 *
 * On a phone the dashboard shows two cards per row, so a card is only ~130px
 * wide inside its padding — too narrow for "22,900.00 ₪" at the desktop
 * size. Two things keep any amount on one line, all the way down to 360px:
 *  1. A whole-shekel amount drops its ".00" on phones (no information lost).
 *  2. The font shrinks to fit the card width (CSS `cqi` units), never growing
 *     past the desktop size, so short values like "4" stay big.
 * On desktop (lg+, five cards beside the sidebar — ~120–165px each) the
 * value has always been allowed to run into the card's start-side padding,
 * up to the sage accent bar. It keeps the desktop size and its ".00" there,
 * and shrinks only when it would otherwise be clipped or run over the bar
 * (`desktopFitDivisor`).
 */

/**
 * Advance widths in em for the display font (Rubik), measured in Chromium.
 * Digits are proportional ("1" is narrow). Callers add their own slack.
 */
const CHAR_EM: Record<string, number> = {
  "0": 0.657,
  "1": 0.463,
  "2": 0.619,
  "3": 0.63,
  "4": 0.652,
  "5": 0.62,
  "6": 0.627,
  "7": 0.543,
  "8": 0.656,
  "9": 0.617,
  ",": 0.264,
  ".": 0.268,
  " ": 0.229,
  "\u00a0": 0.229, // no-break space Intl puts before ₪
  "₪": 0.776,
  "-": 0.48,
  "\u200f": 0, // RLM — zero-width bidi mark Intl adds for he-IL
  "\u200e": 0, // LRM
};
const DEFAULT_CHAR_EM = 0.66; // anything else: as wide as the widest digit

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
 * Divisor for the desktop rule `font-size: min(30px, (100cqi + room) / d)`,
 * where `room` is the padding the value may use beyond the content box. 1% of
 * slack covers rounding while a value that fits today stays at 30px.
 */
export function desktopFitDivisor(text: string): number {
  const em = estimateTextEm(text);
  return Math.ceil(Math.max(em, 0.5) * 1.01 * 1000) / 1000;
}

/**
 * Splits a formatted amount whose agorot are exactly zero ("22,900.00 ₪")
 * into the whole part, the ".00" and the currency suffix, so the ".00" can be
 * hidden on narrow screens. Returns null for anything else (plain counts,
 * amounts with real agorot like "120.50 ₪").
 */
export function splitZeroDecimals(
  text: string,
): { whole: string; decimals: string; suffix: string } | null {
  const m = /^(.*\d)(\.00)(\D*)$/.exec(text);
  if (!m) return null;
  return { whole: m[1], decimals: m[2], suffix: m[3] };
}
