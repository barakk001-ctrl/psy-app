import { db } from "@/lib/db";
import {
  clinicMonthRange,
  expectedIncome,
  incomeEntries,
  lastMonths,
  monthlyTotals,
} from "@/lib/income";
import { loadInvoicePayments, loadSessions } from "@/lib/income-data";
import {
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

export async function loadReportData(
  userId: string,
  period: PeriodKey,
  now = new Date(),
): Promise<ReportData> {
  const [from, to] = getPeriodRange(period, now);

  // 12-month window, clinic calendar, ending with the current month
  const months = lastMonths(12, now);
  const [trendFrom] = clinicMonthRange(months[0].year, months[0].month);
  const [, trendTo] = clinicMonthRange(months[11].year, months[11].month);

  const [periodPayments, periodSessions, trendPayments, trendSessions, outstandingRows] =
    await Promise.all([
      loadInvoicePayments(userId, from, to),
      loadSessions(userId, from, to),
      loadInvoicePayments(userId, trendFrom, trendTo),
      loadSessions(userId, trendFrom, trendTo),
      db.invoice.findMany({
        where: { userId, status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
        include: { client: { select: { firstName: true, lastName: true } } },
        orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      }),
    ]);

  const summary = summarizeIncome(periodPayments, periodSessions, now);

  const received = monthlyTotals(incomeEntries(trendPayments, trendSessions), months);
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
    clientName: `${inv.client.firstName} ${inv.client.lastName}`,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    total: Number(inv.total),
    paid: Number(inv.amountPaid),
    balance: Number(inv.total) - Number(inv.amountPaid),
  }));
  const outstanding = outstandingInvoices.reduce((s, i) => s + i.balance, 0);

  return {
    summary,
    outstanding,
    twelveMonths,
    outstandingInvoices: outstandingInvoices.slice(0, 50),
  };
}
