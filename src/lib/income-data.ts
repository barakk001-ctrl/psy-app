import { db } from "@/lib/db";
import {
  incomeEntries,
  type IncomeEntry,
  type RawInvoicePayment,
  type RawSession,
} from "@/lib/income";

// DB loading for the income rules in income.ts. Everything is scoped by userId.

const name = (c: { firstName: string; lastName: string }) =>
  `${c.firstName} ${c.lastName}`.trim();

/** App-invoice payments received in [from, to). */
export async function loadInvoicePayments(
  userId: string,
  from: Date,
  to: Date,
): Promise<RawInvoicePayment[]> {
  const rows = await db.payment.findMany({
    where: { invoice: { userId }, paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: "asc" },
    select: {
      amount: true,
      paidAt: true,
      method: true,
      invoice: {
        select: { clientId: true, client: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  return rows.map((p) => ({
    amount: Number(p.amount),
    paidAt: p.paidAt,
    method: p.method,
    clientId: p.invoice.clientId,
    clientName: name(p.invoice.client),
  }));
}

/** All meetings starting in [from, to), any status. */
export async function loadSessions(
  userId: string,
  from: Date,
  to: Date,
): Promise<RawSession[]> {
  const rows = await db.session.findMany({
    where: { userId, startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      clientId: true,
      startsAt: true,
      status: true,
      rate: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAmount: true,
      invoiceItem: { select: { id: true } },
      client: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    clientId: s.clientId,
    clientName: name(s.client),
    startsAt: s.startsAt,
    status: s.status,
    rate: s.rate === null ? null : Number(s.rate),
    paymentStatus: s.paymentStatus,
    paymentMethod: s.paymentMethod,
    paidAmount: s.paidAmount === null ? null : Number(s.paidAmount),
    hasInvoice: !!s.invoiceItem,
  }));
}

export type IncomeData = {
  payments: RawInvoicePayment[];
  sessions: RawSession[];
  entries: IncomeEntry[];
};

/** Payments, meetings and the combined income entries for [from, to). */
export async function loadIncome(userId: string, from: Date, to: Date): Promise<IncomeData> {
  const [payments, sessions] = await Promise.all([
    loadInvoicePayments(userId, from, to),
    loadSessions(userId, from, to),
  ]);
  return { payments, sessions, entries: incomeEntries(payments, sessions) };
}
