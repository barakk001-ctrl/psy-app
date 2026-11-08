// DB side of "מסמך חדש" (rules: billing-docs.ts). A document is stored as an
// Invoice row with `docType`; it counts as issued once it has a number: one
// morning returned (before 2026-11-08) or the number of the document issued
// elsewhere, recorded by hand (recordDocumentNumberAction).

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DOC_KINDS,
  canCreditNote,
  docKindByCode,
  documentClientName,
  parseAgorot,
  splitEmails,
  type CardType,
  type DealType,
  type DocumentDraft,
  type PaymentKind,
} from "@/lib/billing-docs";

export type InvoiceWithParts = Prisma.InvoiceGetPayload<{
  include: { items: true; payments: true; client: true };
}>;

/** yyyy-mm-dd of a stored date on the clinic calendar. */
export function clinicDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

/** A stored yyyy-mm-dd → the Date the app keeps for it (as elsewhere: UTC midnight). */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const agorot = (d: Prisma.Decimal | null | undefined) => parseAgorot(d?.toString() ?? "0") ?? 0;

/** The stored document as a draft (null for older app invoices, which have no docType). */
export function draftFromInvoice(inv: InvoiceWithParts): DocumentDraft | null {
  const info = docKindByCode(inv.docType);
  if (!info) return null;
  return {
    kind: info.kind,
    // An unfinished one-off draft has no name yet
    clientName: inv.docClientName ?? (inv.client ? documentClientName(inv) : ""),
    clientTaxId: inv.docClientTaxId,
    clientEmails: splitEmails(inv.docClientEmail),
    date: clinicDay(inv.issueDate),
    dueDate: inv.dueDate ? clinicDay(inv.dueDate) : null,
    vatIncluded: inv.vatIncluded,
    currency: inv.currency,
    lang: inv.lang,
    vatType: inv.vatType,
    rounding: inv.rounding,
    sessionIds: [
      ...inv.draftSessionIds,
      ...inv.items.filter((it) => it.linkOnly && it.sessionId).map((it) => it.sessionId as string),
    ],
    description: inv.description,
    remarks: inv.notes,
    items: inv.items
      .filter((it) => !it.linkOnly)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((it) => ({
        description: it.description,
        quantity: Number(it.quantity.toString()),
        unitPriceAgorot: agorot(it.unitPrice),
        sessionId: it.sessionId,
      })),
    payments: [...inv.payments]
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
      .map((p) => ({
        method: p.method as PaymentKind,
        date: clinicDay(p.paidAt),
        amountAgorot: agorot(p.amount),
        bankName: p.bankName,
        bankBranch: p.bankBranch,
        bankAccount: p.bankAccount,
        chequeNumber: p.chequeNumber,
        cardType: (p.cardType as CardType | null) ?? null,
        cardLast4: p.cardLast4,
        dealType: (p.dealType as DealType | null) ?? null,
        installments: p.installments,
        reference: p.reference,
        details: p.notes,
      })),
  };
}

/** Where a session keeps the number of each kind of document (columns named for morning, kept). */
const SESSION_FIELDS: Partial<Record<number, readonly [string, string]>> = {
  305: ["morningDocNumber", "morningDocUrl"],
  320: ["morningInvoiceReceiptNumber", "morningInvoiceReceiptUrl"],
  400: ["morningReceiptNumber", "morningReceiptUrl"],
};

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Hebrew label of a meeting ticked on a document. */
const linkedSessionLabel = (startsAt: Date) =>
  `פגישה ${new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(startsAt)}`;

/**
 * Turns the meetings ticked on a document into links, once it has a number:
 * a linkOnly item (the meeting now counts as billed) and the number in the
 * meeting's own field, unless one is already there. A meeting that was linked
 * to something else in the meantime is left alone. Internal: nothing here
 * reaches the document.
 */
export async function linkDraftSessions(
  tx: Tx,
  userId: string,
  inv: { id: string; docType: number | null; draftSessionIds: string[]; items: { sessionId: string | null }[] },
  number: string | null,
  url: string | null,
): Promise<void> {
  const free = inv.draftSessionIds.length
    ? await tx.session.findMany({
        where: { id: { in: inv.draftSessionIds }, userId, invoiceItem: null },
        select: { id: true, startsAt: true },
      })
    : [];
  if (free.length) {
    await tx.invoiceItem.createMany({
      data: free.map((s) => ({
        invoiceId: inv.id,
        sessionId: s.id,
        linkOnly: true,
        description: linkedSessionLabel(s.startsAt),
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      })),
      skipDuplicates: true,
    });
  }
  await tx.invoice.update({ where: { id: inv.id }, data: { draftSessionIds: [] } });
  const fields = inv.docType != null ? SESSION_FIELDS[inv.docType] : undefined;
  if (!fields || !number) return;
  const [numberField, urlField] = fields;
  const ids = [...inv.items.map((it) => it.sessionId), ...free.map((s) => s.id)];
  for (const id of ids) {
    if (!id) continue;
    await tx.session.updateMany({
      where: { id, userId, [numberField]: null },
      data: { [numberField]: number, [urlField]: url },
    });
  }
}

/** A credit note linked to a document cancels it and frees its meetings for billing again. */
export async function applyCreditNote(
  tx: Tx,
  userId: string,
  inv: { docType: number | null; relatedInvoiceId: string | null },
): Promise<void> {
  if (inv.docType !== DOC_KINDS.CREDIT_NOTE.code || !inv.relatedInvoiceId) return;
  const orig = await tx.invoice.findFirst({
    where: { id: inv.relatedInvoiceId, userId },
    select: { docType: true, morningDocNumber: true, items: { select: { sessionId: true } } },
  });
  await tx.invoice.updateMany({
    where: { id: inv.relatedInvoiceId, userId },
    data: { status: "CANCELLED" },
  });
  // The cancelled number leaves its meetings too, or they'd stay "linked" and
  // never be suggested again. A number she typed for another document stays.
  const fields = orig?.docType != null ? SESSION_FIELDS[orig.docType] : undefined;
  const sessionIds = orig?.items.map((i) => i.sessionId).filter((s): s is string => !!s) ?? [];
  if (fields && orig?.morningDocNumber && sessionIds.length) {
    await tx.session.updateMany({
      where: { id: { in: sessionIds }, userId, [fields[0]]: orig.morningDocNumber },
      data: { [fields[0]]: null, [fields[1]]: null },
    });
  }
  await tx.invoiceItem.updateMany({
    where: { invoiceId: inv.relatedInvoiceId, invoice: { userId } },
    data: { sessionId: null },
  });
}

/**
 * Issued tax invoices a credit note can still cancel, newest first: the same
 * test as the "ביטול בחשבונית זיכוי" button on the document page. `exceptCreditId`
 * is the credit-note draft being edited, which mustn't rule out its own invoice.
 */
export async function loadCreditableInvoices(userId: string, exceptCreditId?: string) {
  const invoices = await db.invoice.findMany({
    where: {
      userId,
      docType: { in: [DOC_KINDS.TAX_INVOICE.code, DOC_KINDS.TAX_INVOICE_RECEIPT.code] },
      OR: [{ morningDocId: { not: null } }, { morningDocNumber: { not: null } }],
      status: { not: "CANCELLED" },
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    take: 100,
    include: {
      client: { select: { firstName: true, lastName: true } },
      items: { where: { linkOnly: false }, orderBy: { id: "asc" } },
    },
  });
  const credited = await db.invoice.findMany({
    where: {
      userId,
      docType: DOC_KINDS.CREDIT_NOTE.code,
      status: { not: "CANCELLED" },
      relatedInvoiceId: { in: invoices.map((i) => i.id) },
      ...(exceptCreditId ? { id: { not: exceptCreditId } } : {}),
    },
    select: { relatedInvoiceId: true },
  });
  const taken = new Set(credited.map((c) => c.relatedInvoiceId));
  return invoices.filter((i) => canCreditNote(i) && !taken.has(i.id));
}
