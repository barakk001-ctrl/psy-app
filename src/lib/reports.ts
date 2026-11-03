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
  PERIODS,
  getPeriodRange,
  summarizeIncome,
  type IncomeSummary,
  type PeriodKey,
} from "@/lib/report-periods";

export { PERIODS, periodLabel, getPeriodRange, type PeriodKey } from "@/lib/report-periods";

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

/** The numbers that change with the period, for all five of them. */
export type AllPeriodsReport = Omit<ReportData, "summary"> & {
  periods: Record<PeriodKey, IncomeSummary>;
};

/**
 * Everything the reports page shows, each period included, from one load of
 * the widest range: the page switches period in place, with nothing to fetch.
 * Each period goes through summarizeIncome over its own slice, so its numbers
 * are what loading that period alone gives.
 */
export async function loadAllPeriodsReport(userId: string, now = new Date()): Promise<AllPeriodsReport> {
  // 12-month window, clinic calendar, ending with the current month
  const months = lastMonths(12, now);
  const [trendFrom] = clinicMonthRange(months[0].year, months[0].month);
  const [, trendTo] = clinicMonthRange(months[11].year, months[11].month);

  const ranges = PERIODS.map((p) => ({ key: p.key, range: getPeriodRange(p.key, now) }));
  const from = new Date(Math.min(trendFrom.getTime(), ...ranges.map((r) => r.range[0].getTime())));
  const to = new Date(Math.max(trendTo.getTime(), ...ranges.map((r) => r.range[1].getTime())));

  const [allPayments, allSessions, outstandingRows] = await Promise.all([
    loadInvoicePayments(userId, from, to),
    loadSessions(userId, from, to),
    loadOpenDocuments(userId, {
      currency: "ILS",
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
    }),
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
    periods,
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
  const { periods, ...rest } = await loadAllPeriodsReport(userId, now);
  return { ...rest, summary: periods[period] };
}
