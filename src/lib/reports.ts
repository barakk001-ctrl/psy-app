import { documentClientName } from "@/lib/billing-docs";
import {
  clinicMonthRange,
  expectedIncome,
  incomeEntries,
  lastMonths,
  monthlyTotals,
} from "@/lib/income";
import { loadInvoicePayments, loadOpenDocuments, loadSessions } from "@/lib/income-data";
import {
  CUSTOM_PERIOD,
  reportPeriods,
  summarizeIncome,
  type IncomeSummary,
  type PeriodKey,
  type ReportPeriod,
} from "@/lib/report-periods";

export { PERIOD_KEYS, periodLabel, getPeriodRange, type PeriodKey } from "@/lib/report-periods";

export type MonthPoint = {
  label: string;
  value: number; // received
  expected: number; // rates of booked / held meetings
  isPartial: boolean;
};

export type ReportData = {
  summary: IncomeSummary;
  outstanding: number;
  twelveMonths: MonthPoint[];
  outstandingInvoices: {
    id: string;
    number: number;
    clientName: string;
    issueDate: Date;
    dueDate: Date | null;
    total: number;
    paid: number;
    balance: number;
  }[];
};

/** The numbers that change with the period, for every period the page offers. */
export type AllPeriodsReport = Omit<ReportData, "summary"> & {
  /** Labels, dates and ranges, from the same `now` the numbers were cut by. */
  periodList: ReportPeriod[];
  periods: Record<PeriodKey, IncomeSummary>;
  /** The range of her own dates, when one was asked for. */
  custom: IncomeSummary | null;
};

/**
 * Everything the reports page shows, each fixed period included, from one load
 * of the widest range: the page switches period in place, with nothing to fetch.
 * Each period goes through summarizeIncome over its own slice, so its numbers
 * are what loading that period alone gives.
 */
export async function loadAllPeriodsReport(
  userId: string,
  now = new Date(),
  custom: { from: string; to: string } | null = null,
): Promise<AllPeriodsReport> {
  // 12-month window, clinic calendar, ending with the current month
  const months = lastMonths(12, now);
  const [trendFrom] = clinicMonthRange(months[0].year, months[0].month);
  const [, trendTo] = clinicMonthRange(months[11].year, months[11].month);

  const periodList = reportPeriods(now, custom);
  const ranges = periodList.filter((p) => p.key !== CUSTOM_PERIOD);
  const customPeriod = periodList.find((p) => p.key === CUSTOM_PERIOD) ?? null;
  const from = new Date(Math.min(trendFrom.getTime(), ...ranges.map((r) => r.range[0].getTime())));
  const to = new Date(Math.max(trendTo.getTime(), ...ranges.map((r) => r.range[1].getTime())));

  // Her own range can reach years back, so it gets its own load instead of
  // stretching the one above
  const [allPayments, allSessions, outstandingRows, customPayments, customSessions] = await Promise.all([
    loadInvoicePayments(userId, from, to),
    loadSessions(userId, from, to),
    loadOpenDocuments(userId, {
      currency: "ILS",
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
    }),
    customPeriod ? loadInvoicePayments(userId, customPeriod.range[0], customPeriod.range[1]) : null,
    customPeriod ? loadSessions(userId, customPeriod.range[0], customPeriod.range[1]) : null,
  ]);
  const paidIn = ([a, b]: [Date, Date]) => allPayments.filter((p) => p.paidAt >= a && p.paidAt < b);
  const heldIn = ([a, b]: [Date, Date]) => allSessions.filter((s) => s.startsAt >= a && s.startsAt < b);

  const periods = Object.fromEntries(
    ranges.map(({ key, range }) => [key, summarizeIncome(paidIn(range), heldIn(range), now)]),
  ) as Record<PeriodKey, IncomeSummary>;

  const trend: [Date, Date] = [trendFrom, trendTo];
  const trendSessions = heldIn(trend);
  const received = monthlyTotals(incomeEntries(paidIn(trend), trendSessions), months);
  const expectedByMonth = months.map((mo) =>
    expectedIncome(
      trendSessions.filter((s) => {
        const [a, b] = clinicMonthRange(mo.year, mo.month);
        return s.startsAt >= a && s.startsAt < b;
      }),
    ),
  );
  const twelveMonths = months.map((mo, i) => ({
    label: mo.label,
    value: received[i],
    expected: expectedByMonth[i],
    isPartial: i === months.length - 1,
  }));

  const outstandingInvoices = outstandingRows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    clientName: documentClientName(inv),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    total: Number(inv.total),
    paid: inv.paid,
    balance: inv.balance,
  }));
  const outstanding = outstandingInvoices.reduce((s, i) => s + i.balance, 0);

  return {
    periodList,
    periods,
    custom:
      customPayments && customSessions ? summarizeIncome(customPayments, customSessions, now) : null,
    outstanding,
    twelveMonths,
    outstandingInvoices: outstandingInvoices.slice(0, 50),
  };
}

/** One period's report. */
export async function loadReportData(
  userId: string,
  period: PeriodKey,
  now = new Date(),
): Promise<ReportData> {
  const all = await loadAllPeriodsReport(userId, now);
  return {
    summary: all.periods[period],
    outstanding: all.outstanding,
    twelveMonths: all.twelveMonths,
    outstandingInvoices: all.outstandingInvoices,
  };
}
