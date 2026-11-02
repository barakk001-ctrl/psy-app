import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  COUNTS_AS_MONEY,
  DOC_KINDS,
  UNISSUED_DOCUMENT,
  documentClientName,
  isUnissuedDocument,
  parseAgorot,
} from "@/lib/billing-docs";
import {
  incomeEntries,
  type IncomeEntry,
  type RawInvoicePayment,
  type RawSession,
} from "@/lib/income";

// DB loading for the income rules in income.ts. Everything is scoped by userId.

const name = (c: { firstName: string; lastName: string }) =>
  `${c.firstName} ${c.lastName}`.trim();

const clientKey = (inv: Parameters<typeof documentClientName>[0] & { clientId: string | null }) =>
  // One-off clients have no id; each name stands on its own in "by client"
  inv.clientId ?? `one-off:${documentClientName(inv)}`;

/**
 * What issued credit notes in [from, to) give back, as negative entries dated
 * by the credit. Income here is money received, so a credit linked to a
 * document gives back what really came in on it (its own receipt lines and the
 * receipts issued for it): cancelling an unpaid invoice takes nothing off, and
 * a paid document's payments stay in their month while the credit balances them
 * in its own, once. A credit with no link gives back its whole amount.
 */
async function loadCreditNoteRefunds(
  userId: string,
  from: Date,
  to: Date,
): Promise<RawInvoicePayment[]> {
  const credits = await db.invoice.findMany({
    where: {
      userId,
      docType: DOC_KINDS.CREDIT_NOTE.code,
      currency: "ILS",
      status: { not: "CANCELLED" },
      issueDate: { gte: from, lt: to },
      AND: [COUNTS_AS_MONEY],
    },
    select: {
      total: true,
      issueDate: true,
      relatedInvoiceId: true,
      clientId: true,
      docClientName: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
  const originals = credits.map((c) => c.relatedInvoiceId).filter((id): id is string => !!id);
  const receivedOn = new Map<string, number>();
  if (originals.length) {
    const rows = await db.payment.findMany({
      where: {
        invoice: {
          userId,
          AND: [
            COUNTS_AS_MONEY,
            {
              OR: [
                { id: { in: originals } },
                { relatedInvoiceId: { in: originals }, docType: DOC_KINDS.RECEIPT.code },
              ],
            },
          ],
        },
      },
      select: { amount: true, invoice: { select: { id: true, relatedInvoiceId: true } } },
    });
    for (const r of rows) {
      const original = originals.includes(r.invoice.id) ? r.invoice.id : (r.invoice.relatedInvoiceId as string);
      receivedOn.set(original, (receivedOn.get(original) ?? 0) + (parseAgorot(r.amount.toString()) ?? 0));
    }
  }
  const refunds: RawInvoicePayment[] = [];
  for (const c of credits) {
    const total = parseAgorot(c.total.toString()) ?? 0;
    const given = c.relatedInvoiceId ? Math.min(total, receivedOn.get(c.relatedInvoiceId) ?? 0) : total;
    if (given <= 0) continue;
    refunds.push({
      amount: -given / 100,
      paidAt: c.issueDate,
      method: "CREDIT_NOTE",
      clientId: clientKey(c),
      clientName: documentClientName(c),
    });
  }
  return refunds;
}

/** Money received on issued documents in [from, to), less what credit notes gave back. */
export async function loadInvoicePayments(
  userId: string,
  from: Date,
  to: Date,
): Promise<RawInvoicePayment[]> {
  const [rows, refunds] = await Promise.all([
    db.payment.findMany({
      where: {
        invoice: { userId, currency: "ILS", AND: [COUNTS_AS_MONEY] },
        paidAt: { gte: from, lt: to },
      },
      orderBy: { paidAt: "asc" },
      select: {
        amount: true,
        paidAt: true,
        method: true,
        invoice: {
          select: {
            clientId: true,
            docClientName: true,
            client: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    loadCreditNoteRefunds(userId, from, to),
  ]);
  const payments: RawInvoicePayment[] = rows.map((p) => ({
    amount: Number(p.amount),
    paidAt: p.paidAt,
    method: p.method,
    clientId: clientKey(p.invoice),
    clientName: documentClientName(p.invoice),
  }));
  return [...payments, ...refunds].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
}

/**
 * Documents with money still owed, each with what was really paid so far.
 * Never a draft, and never a credit note, which owes nothing. Saving a receipt
 * for a tax invoice already raises that invoice's amountPaid, so an unissued
 * receipt is taken back out here, and an invoice only such a receipt "paid" is
 * still open. Older app invoices count as they always did.
 */
export async function loadOpenDocuments(
  userId: string,
  opts: {
    /** ILS for anything summed: no exchange rate is stored */
    currency?: string;
    clientId?: string;
    take?: number;
    orderBy?: Prisma.InvoiceOrderByWithRelationInput[];
  },
) {
  const unissuedReceipts = await db.invoice.findMany({
    where: {
      userId,
      ...UNISSUED_DOCUMENT,
      docType: DOC_KINDS.RECEIPT.code,
      relatedInvoiceId: { not: null },
      status: { not: "CANCELLED" },
    },
    select: { relatedInvoiceId: true, amountPaid: true },
  });
  const notPaidYet = new Map<string, number>();
  for (const r of unissuedReceipts) {
    const id = r.relatedInvoiceId as string;
    notPaidYet.set(id, (notPaidYet.get(id) ?? 0) + (parseAgorot(r.amountPaid.toString()) ?? 0));
  }

  const rows = await db.invoice.findMany({
    where: {
      userId,
      ...(opts.currency ? { currency: opts.currency } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      AND: [
        COUNTS_AS_MONEY,
        { OR: [{ docType: null }, { docType: { not: DOC_KINDS.CREDIT_NOTE.code } }] },
        {
          OR: [
            { status: { in: ["DRAFT", "SENT", "PARTIALLY_PAID"] } },
            { status: "PAID", id: { in: [...notPaidYet.keys()] } },
          ],
        },
      ],
    },
    orderBy: opts.orderBy ?? [{ issueDate: "asc" }],
    take: opts.take,
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((inv) => {
    const totalAgorot = parseAgorot(inv.total.toString()) ?? 0;
    const paidAgorot = Math.max(0, (parseAgorot(inv.amountPaid.toString()) ?? 0) - (notPaidYet.get(inv.id) ?? 0));
    return { ...inv, paid: paidAgorot / 100, balance: (totalAgorot - paidAgorot) / 100 };
  });
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
      invoiceItem: {
        select: { invoice: { select: { docType: true, morningDocId: true, morningDocNumber: true } } },
      },
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
    // On a draft, the meeting's own payment record is what counts
    hasInvoice: !!s.invoiceItem && !isUnissuedDocument(s.invoiceItem.invoice),
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
