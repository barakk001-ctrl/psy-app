// The Hebrew date of a civil day, for the "תאריך עברי" checkbox above the
// calendar. Computed here from the calendar's own arithmetic (no network and
// no library — the holidays come from Hebcal, the dates do not), so the server,
// Chrome and the iPhone always agree. Client-safe: no imports.
//
// A civil day maps to the Hebrew day whose daytime it is: the date does not
// move forward at sunset. The caller passes the day as it is written on the
// calendar (year, month 1–12, day) — never an instant — so no timezone is
// involved here.

export type CivilDay = { year: number; month: number; day: number };

export type HebrewMonth =
  | "tishrei"
  | "cheshvan"
  | "kislev"
  | "tevet"
  | "shevat"
  | "adar"
  | "adar1"
  | "adar2"
  | "nisan"
  | "iyar"
  | "sivan"
  | "tamuz"
  | "av"
  | "elul";

export type HebrewDate = { year: number; month: HebrewMonth; day: number };

export const HEBREW_MONTH_NAMES: Record<HebrewMonth, string> = {
  tishrei: "תשרי",
  cheshvan: "חשוון",
  kislev: "כסלו",
  tevet: "טבת",
  shevat: "שבט",
  adar: "אדר",
  adar1: "אדר א׳",
  adar2: "אדר ב׳",
  nisan: "ניסן",
  iyar: "אייר",
  sivan: "סיוון",
  tamuz: "תמוז",
  av: "אב",
  elul: "אלול",
};

// ── Calendar arithmetic (Dershowitz & Reingold, "Calendrical Calculations") ──

const DAY_MS = 24 * 60 * 60 * 1000;
/** Day number of 1970-01-01 counting from 0001-01-01 = 1 */
const UNIX_EPOCH_DAY = 719163;
/** Day number of 1 Tishrei of year 1 (7 October 3761 BCE, Julian) */
const HEBREW_EPOCH_DAY = -1373427;

const mod = (a: number, b: number) => ((a % b) + b) % b;

/** A year with thirteen months (Adar I and Adar II). */
export function isHebrewLeapYear(year: number): boolean {
  return mod(7 * year + 1, 19) < 7;
}

/** Days from the epoch to the molad-based new year of `year`, before the last postponement. */
function elapsedDays(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  const day = 29 * months + Math.floor(parts / 25920);
  return mod(3 * (day + 1), 7) < 3 ? day + 1 : day;
}

/** Keeps a year from being 356 or 382 days long. */
function newYearDelay(year: number): number {
  const before = elapsedDays(year - 1);
  const here = elapsedDays(year);
  const after = elapsedDays(year + 1);
  if (after - here === 356) return 2;
  if (here - before === 382) return 1;
  return 0;
}

/** Day number of 1 Tishrei. */
function hebrewNewYear(year: number): number {
  return HEBREW_EPOCH_DAY + elapsedDays(year) + newYearDelay(year);
}

/** The months of a year from Tishrei, with their lengths. */
export function hebrewMonths(year: number): { month: HebrewMonth; days: number }[] {
  const length = hebrewNewYear(year + 1) - hebrewNewYear(year);
  const leap = isHebrewLeapYear(year);
  return [
    { month: "tishrei", days: 30 },
    { month: "cheshvan", days: length % 10 === 5 ? 30 : 29 },
    { month: "kislev", days: length % 10 === 3 ? 29 : 30 },
    { month: "tevet", days: 29 },
    { month: "shevat", days: 30 },
    ...(leap
      ? ([
          { month: "adar1", days: 30 },
          { month: "adar2", days: 29 },
        ] as const)
      : ([{ month: "adar", days: 29 }] as const)),
    { month: "nisan", days: 30 },
    { month: "iyar", days: 29 },
    { month: "sivan", days: 30 },
    { month: "tamuz", days: 29 },
    { month: "av", days: 30 },
    { month: "elul", days: 29 },
  ];
}

/** The Hebrew date of a civil (Gregorian) day. */
export function toHebrewDate({ year, month, day }: CivilDay): HebrewDate {
  const dayNumber = Math.round(Date.UTC(year, month - 1, day) / DAY_MS) + UNIX_EPOCH_DAY;
  // The Hebrew year that starts in the autumn of `year`, or the one before
  let hYear = year + 3761;
  while (hebrewNewYear(hYear) > dayNumber) hYear -= 1;
  while (hebrewNewYear(hYear + 1) <= dayNumber) hYear += 1;

  let left = dayNumber - hebrewNewYear(hYear);
  for (const m of hebrewMonths(hYear)) {
    if (left < m.days) return { year: hYear, month: m.month, day: left + 1 };
    left -= m.days;
  }
  // Unreachable: the months add up to the year's length
  throw new Error("hebrew date out of range");
}

// ── Hebrew numerals ──────────────────────────────────────────────────────────

const ONES = "אבגדהוזחט";
const TENS = "יכלמנסעפצ";
const HUNDREDS = "קרשת";

/** 1–999 in Hebrew letters: ה׳, ט״ו, כ״ט, תשפ״ז (geresh for one letter, gershayim before the last). */
export function gematria(n: number): string {
  let rest = Math.floor(n);
  if (!(rest > 0 && rest < 1000)) return String(n);
  let letters = "";
  while (rest >= 400) {
    letters += "ת";
    rest -= 400;
  }
  if (rest >= 100) {
    letters += HUNDREDS[Math.floor(rest / 100) - 1];
    rest %= 100;
  }
  // 15 and 16 are written 9+6 and 9+7
  if (rest === 15) letters += "טו";
  else if (rest === 16) letters += "טז";
  else {
    if (rest >= 10) letters += TENS[Math.floor(rest / 10) - 1];
    if (rest % 10) letters += ONES[(rest % 10) - 1];
  }
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/** 5787 → תשפ״ז (the thousands are left out, as is usual). */
export function hebrewYearText(year: number): string {
  return gematria(year % 1000);
}

// ── Labels ───────────────────────────────────────────────────────────────────

/** "כ״ט" */
export function hebrewDayText(date: HebrewDate): string {
  return gematria(date.day);
}

/** "כ״ט בחשוון" */
export function hebrewDayMonthText(date: HebrewDate): string {
  return `${gematria(date.day)} ב${HEBREW_MONTH_NAMES[date.month]}`;
}

/**
 * What a day cell shows: the day alone ("כ״ט"), and with its month
 * ("א׳ בכסלו") on the first of a Hebrew month and on the first day on screen,
 * so every month in view is named once. `full` names the month on every day.
 */
export function hebrewCellLabel(day: CivilDay, firstOnScreen: CivilDay | null, full = false): string {
  const h = toHebrewDate(day);
  const first =
    !!firstOnScreen &&
    firstOnScreen.year === day.year &&
    firstOnScreen.month === day.month &&
    firstOnScreen.day === day.day;
  return full || h.day === 1 || first ? hebrewDayMonthText(h) : hebrewDayText(h);
}

/**
 * The Hebrew months a span of civil days covers, for the calendar's title:
 * "כסלו תשפ״ז", "חשוון–כסלו תשפ״ז", or across a new year "אלול תשפ״ו – תשרי תשפ״ז".
 * Both ends are included.
 */
export function hebrewRangeLabel(start: CivilDay, end: CivilDay): string {
  const a = toHebrewDate(start);
  const b = toHebrewDate(end);
  const [ma, mb] = [HEBREW_MONTH_NAMES[a.month], HEBREW_MONTH_NAMES[b.month]];
  if (a.year !== b.year) return `${ma} ${hebrewYearText(a.year)} – ${mb} ${hebrewYearText(b.year)}`;
  if (a.month === b.month) return `${ma} ${hebrewYearText(a.year)}`;
  return `${ma}–${mb} ${hebrewYearText(a.year)}`;
}

// ── The checkbox's memory ────────────────────────────────────────────────────

// "מועדי ישראל" is a column on the account. This box is remembered in the
// browser's localStorage instead (no schema change, and no cookie: the privacy
// policy and the terms promise essential cookies only). The key carries the
// account's id, so on a shared browser the choice follows the person who made
// it; it is per browser — the phone and the laptop each remember their own.

export const HEBREW_DATE_ON = "1";

/** Where this account's choice is kept in localStorage. */
export function hebrewDateStorageKey(userId: string): string {
  return `calendar.hebrewDate.${userId}`;
}

/** Is the box ticked? Anything but the stored "1" (nothing stored, storage blocked) is off. */
export function hebrewDateOn(stored: string | null | undefined): boolean {
  return stored === HEBREW_DATE_ON;
}
