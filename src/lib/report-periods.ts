// Pure period + summary logic for the reports page and the income PDF
// (tested in __tests__/income.test.ts and report-periods.test.ts). DB loading lives in reports.ts.

import {
  clinicDateRange,
  clinicToday,
  expectedIncome,
  incomeByClient,
  incomeByMethod,
  incomeEntries,
  sumAmounts,
  tookPlace,
  type IncomeEntry,
  type RawInvoicePayment,
  type RawSession,
  type Share,
} from "@/lib/income";

/** The fixed periods of /reports, in the order the picker lists them. */
export const PERIOD_KEYS = [
  "last-7-days",
  "last-12-months",
  "this-month",
  "last-month",
  "this-year",
  "last-year",
  "q1",
  "q2",
  "q3",
  "q4",
] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** A range of her own dates (`?from=…&to=…`), the picker's last option. */
export const CUSTOM_PERIOD = "custom";
export type PeriodChoice = PeriodKey | typeof CUSTOM_PERIOD;
export const CUSTOM_PERIOD_LABEL = "לבחירת טווח תאריכים";

export const DEFAULT_PERIOD: PeriodKey = "this-month";

const iso = (y: number, m: number, d: number) =>
  // Date.UTC normalises overflow (month 0 = December before, day 0 = last day)
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/**
 * A period as clinic-calendar dates ("yyyy-mm-dd", both inclusive), from
 * today's date in Israel. Everything else about a period (its range, its
 * labels, the export form's default) is derived from this and the same `now`.
 *  - last-7-days: today and the six days before it.
 *  - last-12-months: this month and the eleven before it, whole months: the
 *    window of the 12-month charts, so its total is the sum of their bars.
 *  - q1–q4: the quarters of the current year, future ones included.
 */
export function periodDates(period: PeriodKey, now = new Date()): { from: string; to: string } {
  const { y, m, d } = clinicToday(now);
  switch (period) {
    case "last-7-days":
      return { from: iso(y, m, d - 6), to: iso(y, m, d) };
    case "last-12-months":
      return { from: iso(y, m - 11, 1), to: iso(y, m + 1, 0) };
    case "this-month":
      return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
    case "last-month":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "this-year":
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case "last-year":
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) };
    case "q1":
    case "q2":
    case "q3":
    case "q4": {
      const q = Number(period[1]);
      return { from: iso(y, q * 3 - 2, 1), to: iso(y, q * 3 + 1, 0) };
    }
  }
}

/** [from, toExclusive) by the clinic's calendar — use `lt`, not `lte`. */
export function getPeriodRange(period: PeriodKey, now = new Date()): [Date, Date] {
  const { from, to } = periodDates(period, now);
  return clinicDateRange(from, to);
}

const MONTH_YEAR = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH = new Intl.DateTimeFormat("he-IL", { month: "long", timeZone: "UTC" });

const midMonth = (date: string) => new Date(`${date.slice(0, 7)}-15T00:00:00Z`);

/**
 * The period's name in the picker, with what it covers today in brackets:
 * "שנה נוכחית (2026)", "חודש קודם (אוקטובר 2026)", "רבעון 4 (2026)". Computed
 * from the same `now` as the range, so the two can't disagree at a year's end.
 */
export function periodOptionLabel(period: PeriodKey, now = new Date()): string {
  const { from } = periodDates(period, now);
  const year = from.slice(0, 4);
  switch (period) {
    case "last-7-days":
      return "7 ימים אחרונים";
    case "last-12-months":
      return "12 חודשים אחרונים";
    case "this-month":
      return `חודש נוכחי (${MONTH_YEAR.format(midMonth(from))})`;
    case "last-month":
      return `חודש קודם (${MONTH_YEAR.format(midMonth(from))})`;
    case "this-year":
      return `שנה נוכחית (${year})`;
    case "last-year":
      return `שנה קודמת (${year})`;
    case "q1":
    case "q2":
    case "q3":
    case "q4":
      return `רבעון ${period[1]} (${year})`;
  }
}

/** What the period covers, for headings: "נובמבר 2026", "2026",
 *  "רבעון 4 2026 (אוקטובר עד דצמבר)", "10.11.2026 עד 16.11.2026". */
export function periodLabel(period: PeriodKey, now = new Date()): string {
  const { from, to } = periodDates(period, now);
  const year = from.slice(0, 4);
  switch (period) {
    case "last-7-days":
      return rangeLabel(from, to);
    case "last-12-months":
      return `${MONTH_YEAR.format(midMonth(from))} עד ${MONTH_YEAR.format(midMonth(to))}`;
    case "this-month":
    case "last-month":
      return MONTH_YEAR.format(midMonth(from));
    case "this-year":
    case "last-year":
      return year;
    case "q1":
    case "q2":
    case "q3":
    case "q4":
      return `רבעון ${period[1]} ${year} (${MONTH.format(midMonth(from))} עד ${MONTH.format(midMonth(to))})`;
  }
}

/** `?period=` from the address; null when it names no period. The single
 *  "רבעון" tab of before 2026-11-16 means the quarter we are in. */
export function parsePeriodParam(
  value: string | null | undefined,
  now = new Date(),
): PeriodKey | null {
  if (value === "this-quarter") {
    return `q${Math.floor((clinicToday(now).m - 1) / 3) + 1}` as PeriodKey;
  }
  return PERIOD_KEYS.find((k) => k === value) ?? null;
}

/** The page's address for a choice; the default period needs no query. */
export function periodHref(period: PeriodKey): string {
  return period === DEFAULT_PERIOD ? "/reports" : `/reports?period=${period}`;
}

export function customPeriodHref(from: string, to: string): string {
  return `/reports?from=${from}&to=${to}`;
}

/** Exactly one calendar month, first day to last. */
export function isWholeMonth(from: string, to: string): boolean {
  const [ty, tm, td] = to.split("-").map(Number);
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return from.slice(0, 7) === to.slice(0, 7) && from.endsWith("-01") && td === lastDay;
}

/** One entry of the reports page: the picker's label, the heading, the dates
 *  and the range the numbers are cut by, all from one `now`. */
export type ReportPeriod = {
  key: PeriodChoice;
  label: string;
  heading: string;
  from: string; // yyyy-mm-dd, inclusive
  to: string;
  range: [Date, Date]; // [from, toExclusive)
  /** Starts after `now` (a later quarter): only booked meetings can show. */
  notStarted: boolean;
};

/** The periods /reports offers today, in picker order, with the custom range
 *  (already validated by parseDateRange) last when one was asked for. */
export function reportPeriods(
  now = new Date(),
  custom?: { from: string; to: string } | null,
): ReportPeriod[] {
  const list: ReportPeriod[] = PERIOD_KEYS.map((key) => {
    const { from, to } = periodDates(key, now);
    const range = clinicDateRange(from, to);
    return {
      key,
      label: periodOptionLabel(key, now),
      heading: periodLabel(key, now),
      from,
      to,
      range,
      notStarted: range[0].getTime() > now.getTime(),
    };
  });
  if (custom) {
    const range = clinicDateRange(custom.from, custom.to);
    list.push({
      key: CUSTOM_PERIOD,
      label: CUSTOM_PERIOD_LABEL,
      heading: rangeLabel(custom.from, custom.to),
      from: custom.from,
      to: custom.to,
      range,
      notStarted: range[0].getTime() > now.getTime(),
    });
  }
  return list;
}

const DAY = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Label for a custom export range: a whole month reads "ספטמבר 2026",
 *  anything else "1.9.2026 עד 15.9.2026". */
export function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (isWholeMonth(from, to)) return MONTH_YEAR.format(new Date(Date.UTC(fy, fm - 1, 15)));
  const f = DAY.format(new Date(Date.UTC(fy, fm - 1, fd)));
  const t = DAY.format(new Date(Date.UTC(ty, tm - 1, td)));
  return f === t ? f : `${f} עד ${t}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates an export range from the query string; null if unusable. */
export function parseDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): { from: string; to: string; range: [Date, Date] } | null {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const valid = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  if (!valid(from) || !valid(to) || from > to) return null;
  // Cap at ~5 years so a typo can't ask for a century of rows
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > 366 * 5) return null;
  return { from, to, range: clinicDateRange(from, to) };
}

export type IncomeSummary = {
  received: number;
  receivedFromInvoices: number;
  receivedFromSessions: number;
  expected: number;
  sessionsHeld: number;
  sessionsCancelled: number;
  byClient: Share[];
  byMethod: Share[];
  entries: IncomeEntry[];
};

/** Totals for a period from the raw rows loaded for it. */
export function summarizeIncome(
  payments: RawInvoicePayment[],
  sessions: RawSession[],
  now = new Date(),
): IncomeSummary {
  const entries = incomeEntries(payments, sessions);
  return {
    received: sumAmounts(entries),
    receivedFromInvoices: sumAmounts(entries.filter((e) => e.source === "invoice")),
    receivedFromSessions: sumAmounts(entries.filter((e) => e.source === "session")),
    expected: expectedIncome(sessions),
    sessionsHeld: sessions.filter((s) => tookPlace(s, now)).length,
    sessionsCancelled: sessions.filter(
      (s) => s.status === "CANCELLED" || s.status === "NO_SHOW",
    ).length,
    byClient: incomeByClient(entries),
    byMethod: incomeByMethod(entries),
    entries,
  };
}
