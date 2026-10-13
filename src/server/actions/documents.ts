"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptionReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { computeInvoiceStatus } from "@/lib/invoice-status";
import {
  DOC_KINDS,
  agorotToDecimalString,
  canCreditNote,
  documentProblems,
  documentTotals,
  lineAgorot,
  parseAgorot,
  type DocumentDraft,
} from "@/lib/billing-docs";
import {
  dayToDate,
  issueStoredDocument,
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
    clientEmail: blank(input.clientEmail),
    date: input.date,
    dueDate: info.hasDueDate ? blank(input.dueDate) : null,
    vatIncluded: input.vatIncluded,
    description: blank(input.description),
    remarks: blank(input.remarks),
    // A receipt keeps only the meetings it covers (for linking), no free lines
    items: input.items
      .filter((it) => info.hasItems || !!it.sessionId)
      .map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPriceAgorot: it.unitPrice,
        sessionId: blank(it.sessionId),
      })),
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

/** Parses + checks the form's JSON against the rules and the user's own data. */
async function parseDraft(userId: string, json: string): Promise<Parsed> {
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

  const [owner, client] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { vatLiable: true } }),
    db.client.findFirst({ where: { id: input.clientId, userId }, select: { id: true } }),
  ]);
  if (!client) return { ok: false, result: { error: "הלקוח/ה לא נמצא/ה." } };
  const vatLiable = !!owner?.vatLiable;

  const problems = documentProblems(draft, vatLiable);
  if (problems.length) return { ok: false, result: { error: "אי אפשר עדיין לשמור את המסמך:", problems } };

  // Meetings: the user's, this client's, not billed yet, each once
  const sessionIds = draft.items.map((it) => it.sessionId).filter((s): s is string => !!s);
  if (new Set(sessionIds).size !== sessionIds.length) {
    return { ok: false, result: { error: "אותה פגישה נבחרה פעמיים." } };
  }
  if (sessionIds.length) {
    const ok = await db.session.count({
      where: { id: { in: sessionIds }, userId, clientId: input.clientId, invoiceItem: null },
    });
    if (ok !== sessionIds.length) {
      return { ok: false, result: { error: "אחת הפגישות שנבחרו כבר חויבה במסמך אחר או אינה של הלקוח/ה." } };
    }
  }

  let relatedInvoice: RelatedInvoice | null = null;
  const relId = blank(input.relatedInvoiceId);
  if (relId) {
    const rel = await db.invoice.findFirst({
      where: { id: relId, userId, clientId: input.clientId },
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

function revalidateDocument(id: string, clientId: string, sessionIds: (string | null)[]) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/collect");
  for (const s of sessionIds) if (s) revalidatePath(`/sessions/${s}`);
}

/**
 * "מסמך חדש": saves the document (always — as a draft first) and, when asked
 * and morning is connected, issues it there. A failed issue leaves the draft
 * saved; the document page then shows why and offers to try again.
 */
export async function saveDocumentAction(
  json: string,
  intent: "draft" | "issue",
): Promise<SaveDocumentResult> {
  const userId = await requireUserId();
  if (await subscriptionReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const p = await parseDraft(userId, json);
  if (!p.ok) return p.result;
  const { input, draft, vatLiable, relatedInvoice } = p;
  const info = DOC_KINDS[draft.kind];
  const totals = documentTotals(draft, vatLiable);
  const total = info.hasItems ? totals.totalAgorot : totals.paymentsAgorot;
  const subtotal = info.hasItems ? totals.linesAgorot : totals.paymentsAgorot;
  const paid = totals.paymentsAgorot;

  const created = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { nextInvoiceNumber: true },
    });
    const inv = await tx.invoice.create({
      data: {
        userId,
        clientId: input.clientId,
        number: updated.nextInvoiceNumber - 1,
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
        docClientName: draft.clientName,
        docClientTaxId: draft.clientTaxId,
        docClientEmail: draft.clientEmail,
        relatedInvoiceId: relatedInvoice?.id ?? null,
        items: {
          create: draft.items.map((it) => ({
            description: it.description,
            quantity: String(it.quantity),
            unitPrice: agorotToDecimalString(it.unitPriceAgorot),
            amount: agorotToDecimalString(lineAgorot(it)),
            sessionId: it.sessionId ?? null,
          })),
        },
        payments: {
          create: draft.payments.map((pm) => ({
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
          })),
        },
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

  revalidateDocument(created.id, input.clientId, draft.items.map((it) => it.sessionId ?? null));
  if (relatedInvoice) revalidatePath(`/invoices/${relatedInvoice.id}`);
  return { invoiceId: created.id, issue };
}

/** morning's PDF of the unsaved form, before anything is issued (base64). */
export async function previewDraftInMorningAction(
  json: string,
): Promise<{ pdfBase64?: string; error?: string; problems?: string[] }> {
  const userId = await requireUserId();
  const creds = await getMorningCredentials(userId);
  if (!creds) return { error: "חשבון morning לא מחובר." };
  const p = await parseDraft(userId, json);
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
    select: { id: true, clientId: true, docType: true, morningDocId: true, status: true, total: true, amountPaid: true, items: { select: { sessionId: true } } },
  });
  if (!inv || inv.docType == null) return { error: "המסמך לא נמצא." };
  if (inv.morningDocId) return { error: "המסמך הופק דרך החיבור ל-morning — המספר כבר שמור." };
  const doc = await db.morningDocument.findFirst({ where: { userId, number }, select: { url: true } });
  const url = doc?.url ?? null;
  const fields: Record<number, [string, string]> = {
    305: ["morningDocNumber", "morningDocUrl"],
    320: ["morningInvoiceReceiptNumber", "morningInvoiceReceiptUrl"],
    400: ["morningReceiptNumber", "morningReceiptUrl"],
  };
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
    const f = fields[inv.docType!];
    if (f) {
      for (const it of inv.items) {
        if (!it.sessionId) continue;
        await tx.session.updateMany({
          where: { id: it.sessionId, userId, [f[0]]: null },
          data: { [f[0]]: number, [f[1]]: url },
        });
      }
    }
  });
  revalidateDocument(inv.id, inv.clientId, inv.items.map((i) => i.sessionId));
  return { saved: true };
}
