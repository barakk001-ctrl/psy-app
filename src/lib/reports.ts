import { db } from "@/lib/db";

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

/**
 * Returns [from, toExclusive] in the user's local time.
 * "toExclusive" is the start of the next period — use `lt` not `lte`.
 */
export function getPeriodRange(period: PeriodKey, now = new Date()): [Date, Date] {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this-month":
      return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case "last-month":
      return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return [new Date(y, qStart, 1), new Date(y, qStart + 3, 1)];
    }
    case "this-year":
      return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    case "last-year":
      return [new Date(y - 1, 0, 1), new Date(y, 0, 1)];
  }
}

export function periodLabel(period: PeriodKey, now = new Date()): string {
  const [from] = getPeriodRange(period, now);
  switch (period) {
    case "this-month":
    case "last-month":
      return new Intl.DateTimeFormat("he-IL", {
        month: "long",
        year: "numeric",
      }).format(from);
    case "this-year":
    case "last-year":
      return String(from.getFullYear());
    case "this-quarter":
      return `רבעון ${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`;
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "מזומן",
  BIT: "ביט",
  CHECK: "המחאה",
  BANK_TRANSFER: "העברה בנקאית",
  CREDIT_CARD: "כרטיס אשראי",
  PAYPAL: "PayPal",
  OTHER: "אחר",
};

export type ReportData = {
  totals: {
    received: number;
    billed: number;
    outstanding: number;
    completedSessions: number;
  };
  twelveMonths: { label: string; value: number; isPartial: boolean }[];
  byMethod: { method: string; label: string; total: number; pct: number }[];
  topClients: { id: string; name: string; total: number; pct: number }[];
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

  // ── Totals for the selected period ──
  const [
    receivedAgg,
    billedAgg,
    outstandingAgg,
    completedSessionsCount,
  ] = await Promise.all([
    db.payment.aggregate({
      where: { invoice: { userId }, paidAt: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      where: {
        userId,
        issueDate: { gte: from, lt: to },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
    }),
    db.invoice.aggregate({
      where: {
        userId,
        status: { in: ["SENT", "PARTIALLY_PAID"] },
      },
      _sum: { total: true, amountPaid: true },
    }),
    db.session.count({
      where: {
        userId,
        status: "COMPLETED",
        startsAt: { gte: from, lt: to },
      },
    }),
  ]);

  // ── 12-month income trend ──
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthlyPayments = await db.payment.findMany({
    where: { invoice: { userId }, paidAt: { gte: trendStart } },
    select: { amount: true, paidAt: true },
  });

  const monthlyMap = new Map<string, number>();
  const months: { label: string; key: string; date: Date }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(trendStart.getFullYear(), trendStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyMap.set(key, 0);
    months.push({
      key,
      date: d,
      label: new Intl.DateTimeFormat("he-IL", { month: "short" }).format(d),
    });
  }
  for (const p of monthlyPayments) {
    const key = `${p.paidAt.getFullYear()}-${p.paidAt.getMonth()}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount));
    }
  }
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const twelveMonths = months.map((m) => ({
    label: m.label,
    value: monthlyMap.get(m.key) ?? 0,
    isPartial: m.key === currentMonthKey,
  }));

  // ── Payment method breakdown for the selected period ──
  const methodAgg = await db.payment.groupBy({
    by: ["method"],
    where: { invoice: { userId }, paidAt: { gte: from, lt: to } },
    _sum: { amount: true },
  });
  const methodTotal = methodAgg.reduce(
    (s, r) => s + Number(r._sum.amount ?? 0),
    0,
  );
  const byMethod = methodAgg
    .map((r) => ({
      method: r.method,
      label: PAYMENT_METHOD_LABELS[r.method] ?? r.method,
      total: Number(r._sum.amount ?? 0),
      pct: methodTotal > 0 ? (Number(r._sum.amount ?? 0) / methodTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Top clients for the selected period ──
  const clientPayments = await db.payment.findMany({
    where: { invoice: { userId }, paidAt: { gte: from, lt: to } },
    select: {
      amount: true,
      invoice: {
        select: {
          clientId: true,
          client: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  const clientMap = new Map<string, { name: string; total: number }>();
  for (const p of clientPayments) {
    const id = p.invoice.clientId;
    const name = `${p.invoice.client.firstName} ${p.invoice.client.lastName}`;
    const existing = clientMap.get(id);
    clientMap.set(id, {
      name,
      total: (existing?.total ?? 0) + Number(p.amount),
    });
  }
  const clientTotal = Array.from(clientMap.values()).reduce(
    (s, c) => s + c.total,
    0,
  );
  const topClients = Array.from(clientMap.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      total: v.total,
      pct: clientTotal > 0 ? (v.total / clientTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Outstanding invoices (regardless of period) ──
  const outstandingRows = await db.invoice.findMany({
    where: { userId, status: { in: ["SENT", "PARTIALLY_PAID"] } },
    include: { client: { select: { firstName: true, lastName: true } } },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
    take: 50,
  });
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

  return {
    totals: {
      received: Number(receivedAgg._sum.amount ?? 0),
      billed: Number(billedAgg._sum.total ?? 0),
      outstanding:
        Number(outstandingAgg._sum.total ?? 0) -
        Number(outstandingAgg._sum.amountPaid ?? 0),
      completedSessions: completedSessionsCount,
    },
    twelveMonths,
    byMethod,
    topClients,
    outstandingInvoices,
  };
}
