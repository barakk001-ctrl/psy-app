// Pure period + summary logic for the reports page and the income PDF
// (tested in __tests__/income.test.ts). DB loading lives in reports.ts.

import {
  clinicDateRange,
  clinicMonthRange,
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

export type PeriodKey =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "this-year"
  | "last-year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "this-month": "החודש",
  "last-month": "החודש שעבר",
  "this-quarter": "הרבעון",
  "this-year": "השנה",
  "last-year": "שנה שעברה",
};

export const PERIODS: { key: PeriodKey; label: string }[] = (
  Object.keys(PERIOD_LABELS) as PeriodKey[]
).map((key) => ({ key, label: PERIOD_LABELS[key] }));

/** [from, toExclusive) by the clinic's calendar — use `lt`, not `lte`. */
export function getPeriodRange(period: PeriodKey, now = new Date()): [Date, Date] {
  const { y, m } = clinicToday(now);
  switch (period) {
    case "this-month":
      return clinicMonthRange(y, m);
    case "last-month":
      return clinicMonthRange(y, m - 1);
    case "this-quarter": {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      return [clinicMonthRange(y, qStart)[0], clinicMonthRange(y, qStart + 2)[1]];
    }
    case "this-year":
      return [clinicMonthRange(y, 1)[0], clinicMonthRange(y, 12)[1]];
    case "last-year":
      return [clinicMonthRange(y - 1, 1)[0], clinicMonthRange(y - 1, 12)[1]];
  }
}

/** The same range as calendar dates ("yyyy-mm-dd", both inclusive) — the
 *  default of the export form. */
export function periodDates(period: PeriodKey, now = new Date()): { from: string; to: string } {
  const { y, m } = clinicToday(now);
  const iso = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  switch (period) {
    case "this-month":
      return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
    case "last-month":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "this-quarter": {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: iso(y, q, 1), to: iso(y, q + 3, 0) };
    }
    case "this-year":
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case "last-year":
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) };
  }
}

const MONTH_YEAR = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function periodLabel(period: PeriodKey, now = new Date()): string {
  const { y, m } = clinicToday(now);
  switch (period) {
    case "this-month":
      return MONTH_YEAR.format(new Date(Date.UTC(y, m - 1, 15)));
    case "last-month":
      return MONTH_YEAR.format(new Date(Date.UTC(y, m - 2, 15)));
    case "this-year":
      return String(y);
    case "last-year":
      return String(y - 1);
    case "this-quarter":
      return `רבעון ${Math.floor((m - 1) / 3) + 1} ${y}`;
  }
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
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  if (fy === ty && fm === tm && fd === 1 && td === lastDay) {
    return MONTH_YEAR.format(new Date(Date.UTC(fy, fm - 1, 15)));
  }
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
