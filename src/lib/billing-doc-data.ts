// DB side of "מסמך חדש" (rules: billing-docs.ts, morning payload: morning.ts).
// A document is stored as an Invoice row with `docType`; it becomes a tax
// document only when morning issues it and returns its id/number/link.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DOC_KINDS,
  canCreditNote,
  docKindByCode,
  documentClientName,
  documentProblems,
  morningPaymentProblems,
  parseAgorot,
  splitEmails,
  type CardType,
  type DealType,
  type DocumentDraft,
  type PaymentKind,
} from "@/lib/billing-docs";
import { computeInvoiceStatus } from "@/lib/invoice-status";
import {
  buildMorningDocumentPayload,
  createMorningDocument,
  getMorningCredentials,
  morningDocUrl,
  previewMorningDocument,
  type MorningPayloadOptions,
} from "@/lib/morning";

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

/** Where a session keeps the number of each kind of morning document. */
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

/** How long an issue in progress blocks another attempt. */
const ISSUE_CLAIM_MS = 2 * 60_000;

export type IssueResult =
  | { ok: true; number: string | null; url: string | null }
  | { ok: false; error: string; uncertain?: boolean };

async function linkOptions(
  userId: string,
  inv: { docType: number | null; relatedInvoiceId: string | null },
): Promise<Pick<MorningPayloadOptions, "linkedDocumentIds" | "linkType"> | { error: string }> {
  // A credit note may stand alone; whether morning agrees isn't documented
  if (!inv.relatedInvoiceId) return {};
  const rel = await db.invoice.findFirst({
    where: { id: inv.relatedInvoiceId, userId },
    select: { morningDocId: true, docType: true },
  });
  if (inv.docType === DOC_KINDS.CREDIT_NOTE.code) {
    if (!rel?.morningDocId) return { error: "המסמך המקורי לא הופק ב-morning, אז אין מה לזכות." };
    return { linkedDocumentIds: [rel.morningDocId], linkType: "cancel" };
  }
  // A receipt for a tax invoice: morning links the two and closes the invoice
  if (rel?.morningDocId && rel.docType === DOC_KINDS.TAX_INVOICE.code) {
    return { linkedDocumentIds: [rel.morningDocId], linkType: "link" };
  }
  return {};
}

/** The morning payload for a stored document, or why there can't be one. */
async function payloadFor(
  userId: string,
  inv: InvoiceWithParts,
): Promise<{ payload: Record<string, unknown> } | { error: string }> {
  const draft = draftFromInvoice(inv);
  if (!draft) return { error: "זו חשבונית מהגרסה הקודמת — מפיקים לה קבלה בכפתור ״הפקת קבלה ב-morning״." };
  const owner = await db.user.findUnique({ where: { id: userId }, select: { vatLiable: true } });
  const vatLiable = !!owner?.vatLiable;
  const problems = [...documentProblems(draft, vatLiable), ...morningPaymentProblems(draft)];
  if (problems.length) return { error: problems.join(" ") };
  const link = await linkOptions(userId, inv);
  if ("error" in link) return link;
  return { payload: buildMorningDocumentPayload(draft, { vatLiable, ...link }) };
}

function loadDocument(userId: string, invoiceId: string) {
  return db.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { items: true, payments: true, client: true },
  });
}

/** morning's own PDF of a stored draft (base64), before issuing. */
export async function previewStoredDocument(
  userId: string,
  invoiceId: string,
): Promise<{ ok: true; pdfBase64: string } | { ok: false; error: string }> {
  const creds = await getMorningCredentials(userId);
  if (!creds) return { ok: false, error: "חשבון morning לא מחובר." };
  const inv = await loadDocument(userId, invoiceId);
  if (!inv) return { ok: false, error: "המסמך לא נמצא." };
  const built = await payloadFor(userId, inv);
  if ("error" in built) return { ok: false, error: built.error };
  const res = await previewMorningDocument(userId, creds, built.payload);
  return res.ok
    ? { ok: true, pdfBase64: res.data }
    : { ok: false, error: `התצוגה המקדימה של morning נכשלה: ${res.error}` };
}

/**
 * Issues a stored draft through morning and keeps what morning returns — on
 * the document, and on the meetings it covers (unless she already typed a
 * number there). Claimed first so a double tap can't issue twice; an attempt
 * that got no answer keeps the claim for two minutes and says to check
 * morning before trying again.
 */
export async function issueStoredDocument(userId: string, invoiceId: string): Promise<IssueResult> {
  const creds = await getMorningCredentials(userId);
  if (!creds) return { ok: false, error: "חשבון morning לא מחובר — מחברים בהגדרות." };
  const inv = await loadDocument(userId, invoiceId);
  if (!inv) return { ok: false, error: "המסמך לא נמצא." };
  if (inv.morningDocId) return { ok: false, error: "המסמך כבר הופק ב-morning." };
  if (inv.status === "CANCELLED") return { ok: false, error: "לא מפיקים מסמך שבוטל." };

  const built = await payloadFor(userId, inv);
  if ("error" in built) return { ok: false, error: built.error };

  // Before anything goes to morning, not after it issued
  if (inv.draftSessionIds.length) {
    const taken = await db.session.count({
      where: { id: { in: inv.draftSessionIds }, userId, invoiceItem: { isNot: null } },
    });
    if (taken > 0) {
      return { ok: false, error: "אחת הפגישות שסומנו כבר משויכת למסמך אחר. מסירים אותה מהטיוטה ומנסים שוב." };
    }
  }

  const claim = await db.invoice.updateMany({
    where: {
      id: invoiceId,
      userId,
      morningDocId: null,
      OR: [{ morningIssuedAt: null }, { morningIssuedAt: { lt: new Date(Date.now() - ISSUE_CLAIM_MS) } }],
    },
    data: { morningIssuedAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: "ההפקה כבר בתהליך. בדקו ב-morning אם המסמך נוצר, ונסו שוב בעוד שתי דקות אם לא.",
    };
  }

  const res = await createMorningDocument(userId, creds, built.payload);
  if (!res.ok) {
    if (!res.uncertain) {
      await db.invoice.updateMany({ where: { id: invoiceId, userId }, data: { morningIssuedAt: null } });
      return { ok: false, error: `morning לא הפיק את המסמך: ${res.error}` };
    }
    return {
      ok: false,
      uncertain: true,
      error:
        "לא התקבלה תשובה מ-morning, וייתכן שהמסמך בכל זאת נוצר. בדקו ב-morning לפני ניסיון נוסף (אפשר לנסות שוב בעוד שתי דקות).",
    };
  }

  const number = res.data.number != null ? String(res.data.number) : null;
  const url = morningDocUrl(res.data);
  const total = Number(inv.total.toString());
  const paid = Number(inv.amountPaid.toString());
  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        morningDocId: res.data.id,
        morningDocNumber: number,
        morningDocUrl: url,
        morningIssuedAt: new Date(),
        status:
          inv.docType === DOC_KINDS.CREDIT_NOTE.code
            ? "SENT"
            : computeInvoiceStatus(inv.status === "DRAFT" ? "SENT" : inv.status, paid, total),
      },
    });
    await linkDraftSessions(tx, userId, inv, number, url);
    await applyCreditNote(tx, userId, inv);
  });
  return { ok: true, number, url };
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
      morningDocId: { not: null },
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
