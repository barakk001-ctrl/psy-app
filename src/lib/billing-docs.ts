// "מסמך חדש" — invoices and receipts in morning's terms (pure, tested).
//
// Legally valid Israeli tax invoices and receipts must come from registered
// software, so the app never issues them itself: with morning connected it
// creates the document THROUGH morning's API (src/lib/morning.ts) and keeps
// the number and link morning returns; without a connection the document is
// a draft (its PDF says it is not a tax document) and the practitioner
// issues it in morning herself, with the details ready to copy.
//
// Money is handled in agorot (integers) here — never float arithmetic.

import { VAT_RATE } from "@/lib/vat";

// ── Document kinds ──────────────────────────────────────────────────────────

export type DocKind = "TAX_INVOICE" | "TAX_INVOICE_RECEIPT" | "RECEIPT" | "CREDIT_NOTE";

export type DocKindInfo = {
  kind: DocKind;
  /** morning's document type code */
  code: number;
  label: string;
  /** one line under the choice */
  hint: string;
  /** income lines (פירוט הכנסות) */
  hasItems: boolean;
  /** receipt lines (פירוט תקבולים) */
  hasPayments: boolean;
  /** "לתשלום עד" */
  hasDueDate: boolean;
  /** only a VAT-liable business (עוסק מורשה) issues it */
  vatLiableOnly: boolean;
};

export const DOC_KINDS: Record<DocKind, DocKindInfo> = {
  TAX_INVOICE: {
    kind: "TAX_INVOICE",
    code: 305,
    label: "חשבונית מס",
    hint: "על שירות שניתן — התשלום יגיע אחר כך (ואז מפיקים קבלה).",
    hasItems: true,
    hasPayments: false,
    hasDueDate: true,
    vatLiableOnly: true,
  },
  TAX_INVOICE_RECEIPT: {
    kind: "TAX_INVOICE_RECEIPT",
    code: 320,
    label: "חשבונית מס/קבלה",
    hint: "מסמך אחד כשהתשלום כבר התקבל.",
    hasItems: true,
    hasPayments: true,
    hasDueDate: false,
    vatLiableOnly: true,
  },
  RECEIPT: {
    kind: "RECEIPT",
    code: 400,
    label: "קבלה",
    hint: "אישור על תשלום שהתקבל — מציגה רק את פירוט התקבולים.",
    hasItems: false,
    hasPayments: true,
    hasDueDate: false,
    vatLiableOnly: false,
  },
  CREDIT_NOTE: {
    kind: "CREDIT_NOTE",
    code: 330,
    label: "חשבונית זיכוי",
    hint: "ביטול (מלא) של חשבונית מס שכבר הופקה.",
    hasItems: true,
    hasPayments: false,
    hasDueDate: false,
    vatLiableOnly: true,
  },
};

export function docKindByCode(code: number | null | undefined): DocKindInfo | undefined {
  return Object.values(DOC_KINDS).find((k) => k.code === code);
}

/** Label for any stored document, including older app invoices (no docType). */
export function docTypeLabel(code: number | null | undefined): string {
  return docKindByCode(code)?.label ?? "חשבונית (דרישת תשלום)";
}

/**
 * The kinds offered in "מסמך חדש". An exempt business (עוסק פטור) issues
 * receipts only; a credit note is issued from the document it cancels.
 */
export function creatableKinds(vatLiable: boolean): DocKindInfo[] {
  return vatLiable
    ? [DOC_KINDS.TAX_INVOICE_RECEIPT, DOC_KINDS.TAX_INVOICE, DOC_KINDS.RECEIPT]
    : [DOC_KINDS.RECEIPT];
}

/** The kind "מסמך חדש" starts on: the Settings preference if allowed. */
export function defaultKind(vatLiable: boolean, preferredCode: number | null | undefined): DocKind {
  const allowed = creatableKinds(vatLiable);
  return (allowed.find((k) => k.code === preferredCode) ?? allowed[0]).kind;
}

/** A credit note can cancel an issued tax invoice (305 / 320) that isn't cancelled. */
export function canCreditNote(doc: {
  docType: number | null;
  morningDocId: string | null;
  status: string;
}): boolean {
  return (
    !!doc.morningDocId &&
    (doc.docType === DOC_KINDS.TAX_INVOICE.code ||
      doc.docType === DOC_KINDS.TAX_INVOICE_RECEIPT.code) &&
    doc.status !== "CANCELLED"
  );
}

// ── Payment (receipt line) kinds ────────────────────────────────────────────

export const PAYMENT_KINDS = [
  "BANK_TRANSFER",
  "BIT",
  "PAYBOX",
  "CREDIT_CARD",
  "CASH",
  "CHECK",
  "PAYPAL",
] as const;
// "אחר" isn't offered: morning's "other" payment needs a sub-type (vouchers,
// crypto…) that doesn't fit a therapy practice.
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  BANK_TRANSFER: "העברה בנקאית",
  BIT: "ביט",
  PAYBOX: "פייבוקס",
  CREDIT_CARD: "כרטיס אשראי",
  CASH: "מזומן",
  CHECK: "המחאה",
  PAYPAL: "PayPal",
};

export type PaymentDetailField =
  | "bankName"
  | "bankBranch"
  | "bankAccount"
  | "chequeNumber"
  | "cardType"
  | "cardLast4"
  | "dealType"
  | "installments"
  | "reference";

/** The extra details each payment type asks for (all optional). */
export const PAYMENT_DETAIL_FIELDS: Record<PaymentKind, PaymentDetailField[]> = {
  BANK_TRANSFER: ["bankName", "bankBranch", "bankAccount"],
  CHECK: ["bankName", "bankBranch", "bankAccount", "chequeNumber"],
  CREDIT_CARD: ["cardType", "cardLast4", "dealType", "installments"],
  PAYPAL: ["reference"],
  BIT: ["reference"],
  PAYBOX: ["reference"],
  CASH: [],
};

export const PAYMENT_DETAIL_LABELS: Record<PaymentDetailField, string> = {
  bankName: "בנק",
  bankBranch: "סניף",
  bankAccount: "מספר חשבון",
  chequeNumber: "מספר המחאה",
  cardType: "סוג כרטיס",
  cardLast4: "4 ספרות אחרונות",
  dealType: "סוג עסקה",
  installments: "מספר תשלומים",
  reference: "מספר אסמכתה",
};

export const CARD_TYPES = ["VISA", "MASTERCARD", "ISRACARD", "AMEX", "DINERS"] as const;
export type CardType = (typeof CARD_TYPES)[number];
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  VISA: "ויזה",
  MASTERCARD: "מאסטרקארד",
  ISRACARD: "ישראכרט",
  AMEX: "אמריקן אקספרס",
  DINERS: "דיינרס",
};

export const DEAL_TYPES = ["REGULAR", "INSTALLMENTS", "CREDIT"] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  REGULAR: "רגיל",
  INSTALLMENTS: "תשלומים",
  CREDIT: "קרדיט",
};

// ── Draft shape (what the form builds, the action stores, morning receives) ──

export type DraftItem = {
  description: string;
  /** quantity (up to 2 decimals) */
  quantity: number;
  /** unit price in agorot */
  unitPriceAgorot: number;
  sessionId?: string | null;
};

export type DraftPayment = {
  method: PaymentKind;
  /** yyyy-mm-dd (clinic calendar) */
  date: string;
  amountAgorot: number;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
  chequeNumber?: string | null;
  cardType?: CardType | null;
  cardLast4?: string | null;
  dealType?: DealType | null;
  installments?: number | null;
  reference?: string | null;
};

export type DocumentDraft = {
  kind: DocKind;
  clientName: string;
  clientTaxId?: string | null;
  /** morning emails the issued document's link here (null = not sent) */
  clientEmail?: string | null;
  /** yyyy-mm-dd */
  date: string;
  /** yyyy-mm-dd, tax invoice only */
  dueDate?: string | null;
  /** prices include VAT (VAT-liable business only) */
  vatIncluded: boolean;
  description?: string | null;
  items: DraftItem[];
  payments: DraftPayment[];
  remarks?: string | null;
};

// ── Money ───────────────────────────────────────────────────────────────────

/** "350", "350.5", "1,200.00" → agorot; null when it isn't a non-negative amount. */
export function parseAgorot(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/[,\s₪]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

/** Agorot → "350.00" (for APIs and Decimal columns). */
export function agorotToDecimalString(agorot: number): string {
  const sign = agorot < 0 ? "-" : "";
  const abs = Math.abs(Math.round(agorot));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Agorot → number of shekels with 2 decimals (morning's JSON wants numbers). */
export function agorotToNumber(agorot: number): number {
  return Number(agorotToDecimalString(agorot));
}

/** Quantity × unit price, rounded to the agora (quantity has up to 2 decimals). */
export function lineAgorot(item: Pick<DraftItem, "quantity" | "unitPriceAgorot">): number {
  const qtyHundredths = Math.round(item.quantity * 100);
  return Math.round((item.unitPriceAgorot * qtyHundredths) / 100);
}

const VAT_PERCENT = Math.round(VAT_RATE * 100);

export type DocumentTotals = {
  /** sum of the lines as typed */
  linesAgorot: number;
  netAgorot: number;
  vatAgorot: number;
  /** what the client pays */
  totalAgorot: number;
  paymentsAgorot: number;
  vatPercent: number;
};

/**
 * Totals. A receipt has no lines — its total is what was received. For a
 * VAT-liable business, lines either include VAT (carved out of the total) or
 * have it added; an exempt business shows no VAT.
 */
export function documentTotals(draft: DocumentDraft, vatLiable: boolean): DocumentTotals {
  const info = DOC_KINDS[draft.kind];
  const paymentsAgorot = info.hasPayments
    ? draft.payments.reduce((s, p) => s + p.amountAgorot, 0)
    : 0;
  const linesAgorot = info.hasItems ? draft.items.reduce((s, it) => s + lineAgorot(it), 0) : 0;

  if (!info.hasItems) {
    // Receipt: received amount; VAT isn't shown on a receipt
    return {
      linesAgorot: 0,
      netAgorot: paymentsAgorot,
      vatAgorot: 0,
      totalAgorot: paymentsAgorot,
      paymentsAgorot,
      vatPercent: VAT_PERCENT,
    };
  }
  if (!vatLiable) {
    return {
      linesAgorot,
      netAgorot: linesAgorot,
      vatAgorot: 0,
      totalAgorot: linesAgorot,
      paymentsAgorot,
      vatPercent: VAT_PERCENT,
    };
  }
  if (draft.vatIncluded) {
    const net = Math.round((linesAgorot * 100) / (100 + VAT_PERCENT));
    return {
      linesAgorot,
      netAgorot: net,
      vatAgorot: linesAgorot - net,
      totalAgorot: linesAgorot,
      paymentsAgorot,
      vatPercent: VAT_PERCENT,
    };
  }
  const vat = Math.round((linesAgorot * VAT_PERCENT) / 100);
  return {
    linesAgorot,
    netAgorot: linesAgorot,
    vatAgorot: vat,
    totalAgorot: linesAgorot + vat,
    paymentsAgorot,
    vatPercent: VAT_PERCENT,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hebrew problems that stop a document from being saved or issued (empty = fine). */
export function documentProblems(draft: DocumentDraft, vatLiable: boolean): string[] {
  const info = DOC_KINDS[draft.kind];
  const problems: string[] = [];
  if (info.vatLiableOnly && !vatLiable) {
    problems.push(`${info.label} מפיק רק עוסק מורשה. בהגדרות העסק מסומן עוסק פטור.`);
  }
  if (!draft.clientName.trim()) problems.push("חסר שם הלקוח/ה על המסמך.");
  if (!DATE_RE.test(draft.date)) problems.push("חסר תאריך מסמך.");
  if (draft.dueDate && !DATE_RE.test(draft.dueDate)) problems.push("תאריך התשלום אינו תקין.");

  if (info.hasItems) {
    if (draft.items.length === 0) problems.push("יש להוסיף לפחות שורה אחת בפירוט ההכנסות.");
    draft.items.forEach((it, i) => {
      if (!it.description.trim()) problems.push(`בשורה ${i + 1} חסר תיאור.`);
      if (!(it.quantity > 0)) problems.push(`בשורה ${i + 1} הכמות חייבת להיות גדולה מאפס.`);
    });
  }
  if (info.hasPayments) {
    if (draft.payments.length === 0) problems.push("יש להוסיף לפחות תקבול אחד.");
    draft.payments.forEach((p, i) => {
      if (!(p.amountAgorot > 0)) problems.push(`בתקבול ${i + 1} הסכום חייב להיות גדול מאפס.`);
      if (!DATE_RE.test(p.date)) problems.push(`בתקבול ${i + 1} חסר תאריך.`);
      if (
        p.method === "CHECK" &&
        !(p.bankName?.trim() && p.bankBranch?.trim() && p.bankAccount?.trim() && p.chequeNumber?.trim())
      ) {
        problems.push(`בתקבול ${i + 1} (המחאה) יש למלא בנק, סניף, מספר חשבון ומספר המחאה.`);
      }
      if (p.cardLast4 && !/^\d{4}$/.test(p.cardLast4)) {
        problems.push(`בתקבול ${i + 1} יש להקליד בדיוק 4 ספרות של הכרטיס.`);
      }
      if (p.installments != null && !(Number.isInteger(p.installments) && p.installments >= 1 && p.installments <= 36)) {
        problems.push(`בתקבול ${i + 1} מספר התשלומים אינו תקין.`);
      }
    });
  }

  const totals = documentTotals(draft, vatLiable);
  if (info.hasItems && totals.totalAgorot <= 0) problems.push("סכום המסמך חייב להיות גדול מאפס.");
  if (info.hasItems && info.hasPayments && totals.paymentsAgorot !== totals.totalAgorot) {
    problems.push(
      `סכום התקבולים (₪${agorotToDecimalString(totals.paymentsAgorot)}) צריך להיות שווה לסכום המסמך (₪${agorotToDecimalString(totals.totalAgorot)}).`,
    );
  }
  return problems;
}

// ── Without a connection: issuing in morning by hand ────────────────────────

/** morning's own "new document" screen for this type. */
export function morningNewDocumentUrl(kind: DocKind): string {
  return `https://app.greeninvoice.co.il/incomes/documents/new/${DOC_KINDS[kind].code}`;
}

/**
 * Plain-text summary to paste into morning's form (the web app has no
 * documented way to prefill a new document from a link).
 */
export function morningCopyText(draft: DocumentDraft, vatLiable: boolean): string {
  const info = DOC_KINDS[draft.kind];
  const totals = documentTotals(draft, vatLiable);
  const ils = (a: number) => `₪${agorotToDecimalString(a)}`;
  const lines: string[] = [`${info.label}`, `לקוח/ה: ${draft.clientName}`];
  if (draft.clientTaxId) lines.push(`ת״ז / ח״פ: ${draft.clientTaxId}`);
  lines.push(`תאריך: ${draft.date}`);
  if (info.hasDueDate && draft.dueDate) lines.push(`לתשלום עד: ${draft.dueDate}`);
  if (draft.description) lines.push(`תיאור: ${draft.description}`);
  if (info.hasItems) {
    lines.push(vatLiable ? (draft.vatIncluded ? "המחירים כוללים מע״מ" : "המחירים לא כוללים מע״מ") : "");
    for (const it of draft.items) {
      lines.push(`• ${it.description} — ${it.quantity} × ${ils(it.unitPriceAgorot)}`);
    }
  }
  if (info.hasPayments) {
    lines.push("תקבולים:");
    for (const p of draft.payments) {
      const extra = PAYMENT_DETAIL_FIELDS[p.method]
        .map((f) => {
          const v = p[f];
          if (v == null || v === "") return null;
          const shown =
            f === "cardType"
              ? CARD_TYPE_LABELS[v as CardType]
              : f === "dealType"
                ? DEAL_TYPE_LABELS[v as DealType]
                : String(v);
          return `${PAYMENT_DETAIL_LABELS[f]}: ${shown}`;
        })
        .filter(Boolean)
        .join(", ");
      lines.push(
        `• ${PAYMENT_KIND_LABELS[p.method]} ${ils(p.amountAgorot)} (${p.date})${extra ? ` — ${extra}` : ""}`,
      );
    }
  }
  lines.push(`סה״כ: ${ils(totals.totalAgorot)}`);
  if (draft.remarks) lines.push(`הערות: ${draft.remarks}`);
  return lines.filter((l) => l !== "").join("\n");
}
