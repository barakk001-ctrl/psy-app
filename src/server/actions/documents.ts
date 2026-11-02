"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isReadOnly, subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { computeInvoiceStatus } from "@/lib/invoice-status";
import {
  DOC_KINDS,
  agorotToDecimalString,
  canCreditNote,
  documentProblems,
  documentTotals,
  draftSaveProblems,
  joinEmails,
  lineAgorot,
  parseAgorot,
  type DocumentDraft,
} from "@/lib/billing-docs";
import {
  dayToDate,
  issueStoredDocument,
  linkDraftSessions,
  previewStoredDocument,
  type IssueResult,
} from "@/lib/billing-doc-data";
import {
  buildMorningDocumentPayload,
  getMorningCredentials,
  previewMorningDocument,
} from "@/lib/morning";
import { documentDraftSchema, type DocumentDraftInput } from "@/server/validators/billing-document";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SaveDocumentResult = {
  error?: string;
  /** rule problems (Hebrew), shown as a list */
  problems?: string[];
  invoiceId?: string;
  /** set when issuing was asked for */
  issue?: IssueResult;
};

const blank = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

/** The validated form input as a draft (amounts already in agorot). */
function toDraft(input: DocumentDraftInput): DocumentDraft {
  const info = DOC_KINDS[input.kind];
  return {
    kind: input.kind,
    clientName: input.clientName,
    clientTaxId: blank(input.clientTaxId),
    clientEmails: input.clientEmails.map((e) => e.trim()).filter(Boolean),
    date: input.date,
    dueDate: info.hasDueDate ? blank(input.dueDate) : null,
    vatIncluded: input.vatIncluded,
    currency: input.currency,
    sessionIds: info.hasSessions && blank(input.clientId) ? [...new Set(input.sessionIds)] : [],
    description: blank(input.description),
    remarks: blank(input.remarks),
    // A row left completely empty isn't a line
    items: info.hasItems
      ? input.items
          .filter((it) => it.description || it.unitPrice > 0)
          .map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPriceAgorot: it.unitPrice,
          }))
      : [],
    payments: info.hasPayments
      ? input.payments.map((p) => ({
          method: p.method,
          date: p.date,
          amountAgorot: p.amount,
          bankName: blank(p.bankName),
          bankBranch: blank(p.bankBranch),
          bankAccount: blank(p.bankAccount),
          chequeNumber: blank(p.chequeNumber),
          cardType: p.cardType || null,
          cardLast4: blank(p.cardLast4),
          dealType: p.dealType || null,
          installments: typeof p.installments === "number" ? p.installments : null,
          reference: blank(p.reference),
        }))
      : [],
  };
}

type RelatedInvoice = { id: string; morningDocId: string | null; total: string; status: string };

type Parsed =
  | { ok: false; result: SaveDocumentResult }
  | {
      ok: true;
      input: DocumentDraftInput;
      draft: DocumentDraft;
      vatLiable: boolean;
      relatedInvoice: RelatedInvoice | null;
    };

/**
 * Parses + checks the form's JSON against the rules and the user's own data.
 * `complete` is for preview and issuing; a draft may be unfinished. A receipt
 * for an invoice is always complete, since saving it settles that invoice.
 */
async function parseDraft(userId: string, json: string, complete: boolean): Promise<Parsed> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, result: { error: "הטופס לא נשלח כראוי — נסו שוב." } };
  }
  const parsed = documentDraftSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message);
    return { ok: false, result: { error: "יש לתקן כמה פרטים בטופס.", problems: [...new Set(issues)] } };
  }
  const input = parsed.data;
  const draft = toDraft(input);

  const clientId = blank(input.clientId);
  const draftId = blank(input.draftId);
  const [owner, client] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { vatLiable: true } }),
    clientId ? db.client.findFirst({ where: { id: clientId, userId }, select: { id: true } }) : null,
  ]);
  if (clientId && !client) return { ok: false, result: { error: "הלקוח/ה לא נמצא/ה." } };
  const vatLiable = !!owner?.vatLiable;

  const relId = blank(input.relatedInvoiceId);
  const problems =
    complete || relId
      ? [...(clientId || draft.clientName.trim() ? [] : ["יש לבחור לקוח/ה או למלא שם של לקוח מזדמן."]), ...documentProblems(draft, vatLiable)]
      : draftSaveProblems(draft);
  if (problems.length) return { ok: false, result: { error: "אי אפשר עדיין לשמור את המסמך:", problems } };

  // Meetings: the user's, this client's, not billed yet (a draft being edited
  // may hold links from before they were kept apart from the lines)
  const sessionIds = draft.sessionIds ?? [];
  if (sessionIds.length) {
    const ok = await db.session.count({
      where: {
        id: { in: sessionIds },
        userId,
        clientId: clientId as string,
        OR: [{ invoiceItem: null }, ...(draftId ? [{ invoiceItem: { invoiceId: draftId } }] : [])],
      },
    });
    if (ok !== sessionIds.length) {
      return { ok: false, result: { error: "אחת הפגישות שנבחרו כבר חויבה במסמך אחר או אינה של הלקוח/ה." } };
    }
  }

  let relatedInvoice: RelatedInvoice | null = null;
  if (relId) {
    const rel = await db.invoice.findFirst({
      where: { id: relId, userId, clientId },
      select: { id: true, morningDocId: true, total: true, status: true, docType: true },
    });
    if (!rel || rel.docType !== DOC_KINDS.TAX_INVOICE.code || input.kind !== "RECEIPT") {
      return { ok: false, result: { error: "החשבונית שהקבלה משלמת לא נמצאה." } };
    }
    if (rel.status === "CANCELLED") return { ok: false, result: { error: "החשבונית בוטלה." } };
    relatedInvoice = { id: rel.id, morningDocId: rel.morningDocId, total: rel.total.toString(), status: rel.status };
  }
  return { ok: true, input, draft, vatLiable, relatedInvoice };
}

function revalidateDocument(id: string, clientId: string | null, sessionIds: (string | null)[]) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/collect");
  for (const s of sessionIds) if (s) revalidatePath(`/sessions/${s}`);
}

/**
 * "מסמך חדש": saves the document (always — as a draft first) and, when asked
 * and morning is connected, issues it there. A failed issue leaves the draft
 * saved; the document page then shows why and offers to try again. With
 * `draftId` it updates that saved draft instead of adding a document.
 */
export async function saveDocumentAction(
  json: string,
  intent: "draft" | "issue",
): Promise<SaveDocumentResult> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const p = await parseDraft(userId, json, intent === "issue");
  if (!p.ok) return p.result;
  const { input, draft, vatLiable, relatedInvoice } = p;
  const clientId = blank(input.clientId);
  const draftId = blank(input.draftId);
  const info = DOC_KINDS[draft.kind];
  const totals = documentTotals(draft, vatLiable);
  const total = info.hasItems ? totals.totalAgorot : totals.paymentsAgorot;
  const subtotal = info.hasItems ? totals.linesAgorot : totals.paymentsAgorot;
  const paid = totals.paymentsAgorot;

  const fields = {
    clientId,
    docType: info.code,
    issueDate: dayToDate(draft.date),
    dueDate: draft.dueDate ? dayToDate(draft.dueDate) : null,
    status: computeInvoiceStatus("DRAFT", paid, total),
    subtotal: agorotToDecimalString(subtotal),
    total: agorotToDecimalString(total),
    amountPaid: agorotToDecimalString(paid),
    notes: draft.remarks,
    description: draft.description,
    vatIncluded: draft.vatIncluded,
    currency: draft.currency,
    docClientName: draft.clientName || null,
    docClientTaxId: draft.clientTaxId,
    docClientEmail: joinEmails(draft.clientEmails),
    draftSessionIds: draft.sessionIds ?? [],
  };
  const itemRows = draft.items.map((it) => ({
    description: it.description,
    quantity: String(it.quantity),
    unitPrice: agorotToDecimalString(it.unitPriceAgorot),
    amount: agorotToDecimalString(lineAgorot(it)),
  }));
  const paymentRows = draft.payments.map((pm) => ({
    amount: agorotToDecimalString(pm.amountAgorot),
    method: pm.method,
    paidAt: dayToDate(pm.date),
    reference: pm.reference,
    bankName: pm.bankName,
    bankBranch: pm.bankBranch,
    bankAccount: pm.bankAccount,
    chequeNumber: pm.chequeNumber,
    cardType: pm.cardType,
    cardLast4: pm.cardLast4,
    dealType: pm.dealType,
    installments: pm.installments,
  }));

  if (draftId) {
    // Only a draft nothing was issued for, that isn't being issued right now,
    // and that settles no invoice (saving those already moved money)
    const editable = await db.invoice.updateMany({
      where: {
        id: draftId,
        userId,
        docType: { not: null },
        morningDocId: null,
        morningDocNumber: null,
        relatedInvoiceId: null,
        status: { not: "CANCELLED" },
        OR: [{ morningIssuedAt: null }, { morningIssuedAt: { lt: new Date(Date.now() - 2 * 60_000) } }],
      },
      data: fields,
    });
    if (editable.count === 0) return { error: "אי אפשר לערוך את המסמך הזה: הוא כבר הופק או בוטל." };
    await db.invoice.update({
      where: { id: draftId },
      data: {
        items: { deleteMany: {}, create: itemRows },
        payments: { deleteMany: {}, create: paymentRows },
      },
    });
  }

  const created = draftId
    ? { id: draftId }
    : await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { nextInvoiceNumber: true },
    });
    const inv = await tx.invoice.create({
      data: {
        userId,
        number: updated.nextInvoiceNumber - 1,
        ...fields,
        relatedInvoiceId: relatedInvoice?.id ?? null,
        items: { create: itemRows },
        payments: { create: paymentRows },
      },
      select: { id: true },
    });
    // A receipt for a tax invoice settles that invoice (the money itself is
    // counted once, on the receipt's payment lines)
    if (relatedInvoice) {
      const relPaid = await tx.invoice.findUnique({
        where: { id: relatedInvoice.id },
        select: { amountPaid: true, total: true, status: true },
      });
      if (relPaid) {
        const newPaid = (parseAgorot(relPaid.amountPaid.toString()) ?? 0) + paid;
        const relTotal = parseAgorot(relPaid.total.toString()) ?? 0;
        await tx.invoice.update({
          where: { id: relatedInvoice.id },
          data: {
            amountPaid: agorotToDecimalString(newPaid),
            status: computeInvoiceStatus(
              relPaid.status === "DRAFT" ? "SENT" : relPaid.status,
              newPaid,
              relTotal,
            ),
          },
        });
      }
    }
    return inv;
  });

  let issue: IssueResult | undefined;
  if (intent === "issue") issue = await issueStoredDocument(userId, created.id);

  revalidateDocument(created.id, clientId, draft.sessionIds ?? []);
  if (relatedInvoice) revalidatePath(`/invoices/${relatedInvoice.id}`);
  return { invoiceId: created.id, issue };
}

/** morning's PDF of the unsaved form, before anything is issued (base64). */
export async function previewDraftInMorningAction(
  json: string,
): Promise<{ pdfBase64?: string; error?: string; problems?: string[] }> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const creds = await getMorningCredentials(userId);
  if (!creds) return { error: "חשבון morning לא מחובר." };
  const p = await parseDraft(userId, json, true);
  if (!p.ok) return { error: p.result.error, problems: p.result.problems };
  const link =
    p.relatedInvoice?.morningDocId != null
      ? { linkedDocumentIds: [p.relatedInvoice.morningDocId], linkType: "link" as const }
      : {};
  const payload = buildMorningDocumentPayload(p.draft, { vatLiable: p.vatLiable, ...link });
  const res = await previewMorningDocument(userId, creds, payload);
  return res.ok ? { pdfBase64: res.data } : { error: `התצוגה המקדימה של morning נכשלה: ${res.error}` };
}

/** morning's PDF of a saved draft (document page). */
export async function previewStoredInMorningAction(
  invoiceId: string,
): Promise<{ pdfBase64?: string; error?: string }> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const res = await previewStoredDocument(userId, invoiceId);
  return res.ok ? { pdfBase64: res.pdfBase64 } : { error: res.error };
}

/** "הפקה ב-morning" for a saved draft (document page). */
export async function issueDocumentAction(invoiceId: string): Promise<IssueResult> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { ok: false, error: READ_ONLY_ERROR };
  const res = await issueStoredDocument(userId, invoiceId);
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { clientId: true, items: { select: { sessionId: true } } },
  });
  if (inv) revalidateDocument(invoiceId, inv.clientId, inv.items.map((i) => i.sessionId));
  return res;
}

/**
 * "ביטול בחשבונית זיכוי": a credit note (330) for the whole of an issued tax
 * invoice, issued through morning and linked to it ("cancel"). On success the
 * invoice is marked cancelled and its meetings can be billed again.
 */
export async function creditNoteAction(
  invoiceId: string,
): Promise<{ error?: string; creditNoteId?: string; issue?: IssueResult }> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  if (!(await getMorningCredentials(userId))) return { error: "חשבון morning לא מחובר." };
  const orig = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!orig) return { error: "המסמך לא נמצא." };
  if (!canCreditNote(orig)) return { error: "אפשר לזכות רק חשבונית מס שהופקה ב-morning ולא בוטלה." };
  const existing = await db.invoice.findFirst({
    where: { userId, relatedInvoiceId: orig.id, docType: DOC_KINDS.CREDIT_NOTE.code },
    select: { id: true, morningDocId: true },
  });
  if (existing?.morningDocId) return { error: "כבר הופקה חשבונית זיכוי למסמך הזה." };

  const creditId =
    existing?.id ??
    (
      await db.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: { nextInvoiceNumber: { increment: 1 } },
          select: { nextInvoiceNumber: true },
        });
        return tx.invoice.create({
          data: {
            userId,
            clientId: orig.clientId,
            number: updated.nextInvoiceNumber - 1,
            docType: DOC_KINDS.CREDIT_NOTE.code,
            issueDate: dayToDate(
              new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()),
            ),
            status: "DRAFT",
            subtotal: orig.subtotal,
            total: orig.total,
            amountPaid: 0,
            notes: `זיכוי עבור ${orig.docType === 320 ? "חשבונית מס/קבלה" : "חשבונית מס"} ${orig.morningDocNumber ?? ""}`.trim(),
            vatIncluded: orig.vatIncluded,
            docClientName: orig.docClientName,
            docClientTaxId: orig.docClientTaxId,
            docClientEmail: orig.docClientEmail,
            relatedInvoiceId: orig.id,
            items: {
              create: orig.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                amount: it.amount,
              })),
            },
          },
          select: { id: true },
        });
      })
    ).id;

  const issue = await issueStoredDocument(userId, creditId);
  revalidateDocument(creditId, orig.clientId, orig.items.map((i) => i.sessionId));
  revalidatePath(`/invoices/${orig.id}`);
  return { creditNoteId: creditId, issue };
}

/**
 * Without a connection: she issued the draft in morning herself and types the
 * number here. Like the meeting's number fields, a synced morning document
 * with that number supplies the link. The meetings get the number too
 * (unless one is already typed there).
 */
export async function setDocumentMorningNumberAction(
  invoiceId: string,
  rawNumber: string,
): Promise<{ error?: string; saved?: boolean }> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const number = rawNumber.trim().slice(0, 30);
  if (!/^\d+$/.test(number)) return { error: "מספר המסמך ב-morning הוא מספר (ספרות בלבד)." };
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { id: true, clientId: true, docType: true, morningDocId: true, status: true, total: true, amountPaid: true, draftSessionIds: true, items: { select: { sessionId: true } } },
  });
  if (!inv || inv.docType == null) return { error: "המסמך לא נמצא." };
  if (inv.morningDocId) return { error: "המסמך הופק דרך החיבור ל-morning — המספר כבר שמור." };
  const doc = await db.morningDocument.findFirst({ where: { userId, number }, select: { url: true } });
  const url = doc?.url ?? null;
  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        morningDocNumber: number,
        morningDocUrl: url,
        status:
          inv.status === "DRAFT"
            ? computeInvoiceStatus(
                "SENT",
                parseAgorot(inv.amountPaid.toString()) ?? 0,
                parseAgorot(inv.total.toString()) ?? 0,
              )
            : inv.status,
      },
    });
    await linkDraftSessions(tx, userId, inv, number, url);
  });
  revalidateDocument(inv.id, inv.clientId, [...inv.items.map((i) => i.sessionId), ...inv.draftSessionIds]);
  return { saved: true };
}
