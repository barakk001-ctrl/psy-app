// "מסמך חדש" — invoices and receipts (pure, tested). The type codes are the
// Israeli ones the old morning integration used (305/320/400/330).
//
// Legally valid Israeli tax invoices and receipts must come from registered
// software, and the app is not registered yet, so it never issues them: a
// document here is a draft (its PDF says it is not a tax document) until the
// practitioner records the number of the document she issued elsewhere. The
// morning integration was removed on 2026-11-08; documents it issued keep
// their id/number/link (morningDoc* columns) and count as before.
//
// Money is handled in agorot (integers) here — never float arithmetic.

import { VAT_RATE } from "@/lib/vat";

// ── Document kinds ──────────────────────────────────────────────────────────

export type DocKind = "TAX_INVOICE" | "TAX_INVOICE_RECEIPT" | "RECEIPT" | "CREDIT_NOTE";

export type DocKindInfo = {
  kind: DocKind;
  /** the document type code (305 / 320 / 400 / 330) */
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
  /** "ח.פ / ת.ז לקוח" is asked for in the form */
  hasTaxId: boolean;
  /** meetings can be linked to it (internal, never printed) */
  hasSessions: boolean;
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
    hasTaxId: true,
    hasSessions: true,
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
    hasTaxId: true,
    hasSessions: true,
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
    hasTaxId: false,
    hasSessions: true,
  },
  CREDIT_NOTE: {
    kind: "CREDIT_NOTE",
    code: 330,
    label: "חשבונית זיכוי",
    hint: "זיכוי ללקוח/ה, עם קישור למסמך המקורי או בלעדיו.",
    hasItems: true,
    hasPayments: false,
    hasDueDate: false,
    vatLiableOnly: true,
    hasTaxId: false,
    hasSessions: false,
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
 * receipts only. The first one is where the form starts with no preference.
 */
export function creatableKinds(vatLiable: boolean): DocKindInfo[] {
  return vatLiable
    ? [DOC_KINDS.TAX_INVOICE_RECEIPT, DOC_KINDS.TAX_INVOICE, DOC_KINDS.RECEIPT, DOC_KINDS.CREDIT_NOTE]
    : [DOC_KINDS.RECEIPT];
}

/** The document-type squares, in the order the practitioner reads them. */
export function docKindSquares(vatLiable: boolean): DocKindInfo[] {
  return [
    DOC_KINDS.TAX_INVOICE,
    DOC_KINDS.TAX_INVOICE_RECEIPT,
    DOC_KINDS.RECEIPT,
    DOC_KINDS.CREDIT_NOTE,
  ].filter((k) => vatLiable || !k.vatLiableOnly);
}

/** The kind "מסמך חדש" starts on: the Settings preference if allowed. */
export function defaultKind(vatLiable: boolean, preferredCode: number | null | undefined): DocKind {
  const allowed = creatableKinds(vatLiable);
  return (allowed.find((k) => k.code === preferredCode) ?? allowed[0]).kind;
}

// ── Issued or not: the one test ─────────────────────────────────────────────
//
// Every "is this document issued?" decision goes through here (PR 1.1 of
// docs/accounting/implementation-plan.md), so that documents the app issues
// itself later plug in by changing these and nothing else.

/** The columns the issued test reads. */
export type IssuedFields = { morningDocId: string | null; morningDocNumber: string | null };

/**
 * Issued = morning gave it an id (before 2026-11-08) or the number of the
 * document issued elsewhere was recorded. Says nothing about the type: an
 * older app invoice (`docType` null) with a morning id had a receipt issued
 * for it by morning.
 */
export function isIssuedDocument(doc: IssuedFields): boolean {
  return !!(doc.morningDocId || doc.morningDocNumber);
}

/** The query form of isIssuedDocument. Goes under `AND`, since it is an `OR`. */
export const ISSUED_DOCUMENT = {
  OR: [{ morningDocId: { not: null } }, { morningDocNumber: { not: null } }],
};

/** The query form of !isIssuedDocument (spread into a where). */
export const NOT_ISSUED = { morningDocId: null, morningDocNumber: null } as const;

/**
 * The document carries a printed number (`morningDocNumber`). What the lists,
 * the document page and the PDF show as "issued", and what cancelling an
 * older-style row checks. Narrower than isIssuedDocument only for a row with
 * a morning id and no number, which morning issuing could in principle leave;
 * kept apart so that consolidating the checks changed no behaviour.
 */
export function hasDocumentNumber(doc: { morningDocNumber: string | null }): boolean {
  return !!doc.morningDocNumber;
}

/** The query form of hasDocumentNumber. */
export const HAS_DOCUMENT_NUMBER = { morningDocNumber: { not: null } };

/** The query form of !hasDocumentNumber (spread into a where). */
export const NO_DOCUMENT_NUMBER = { morningDocNumber: null } as const;

/**
 * A credit note can cancel an issued tax invoice (305 / 320) that isn't
 * cancelled.
 */
export function canCreditNote(doc: IssuedFields & { docType: number | null; status: string }): boolean {
  return (
    isIssuedDocument(doc) &&
    (doc.docType === DOC_KINDS.TAX_INVOICE.code ||
      doc.docType === DOC_KINDS.TAX_INVOICE_RECEIPT.code) &&
    doc.status !== "CANCELLED"
  );
}

/**
 * A "מסמך חדש" document counts as money only once it is issued. Older app
 * invoices have no issued state and count as they always did.
 */
export function isUnissuedDocument(doc: IssuedFields & { docType: number | null }): boolean {
  return doc.docType != null && !isIssuedDocument(doc);
}

/** The query form of !isUnissuedDocument. Goes under `AND`, since it holds an `OR` of its own. */
export const COUNTS_AS_MONEY = {
  OR: [{ docType: null }, ...ISSUED_DOCUMENT.OR],
};

/** The query form of isUnissuedDocument. */
export const UNISSUED_DOCUMENT = {
  docType: { not: null },
  ...NOT_ISSUED,
};

// ── Meetings and their document numbers ─────────────────────────────────────

/** A meeting's number fields (one per type, names kept from the morning era). */
export type SessionNumberFields = {
  morningDocNumber: string | null;
  morningReceiptNumber: string | null;
  morningInvoiceReceiptNumber: string | null;
};

/** A document number was typed on the meeting or written there when a document got its number. */
export function sessionHasDocumentNumber(s: SessionNumberFields): boolean {
  return !!(s.morningDocNumber || s.morningReceiptNumber || s.morningInvoiceReceiptNumber);
}

/** The query form of sessionHasDocumentNumber. Goes under `AND`, since it is an `OR`. */
export const SESSION_HAS_DOCUMENT_NUMBER = {
  OR: [
    { morningDocNumber: { not: null } },
    { morningReceiptNumber: { not: null } },
    { morningInvoiceReceiptNumber: { not: null } },
  ],
};

/**
 * A meeting that has no payment link yet, which is what "מסמך חדש" suggests:
 * on no document, and no document number typed or written on it either way.
 */
export const UNLINKED_SESSION = {
  invoiceItem: null,
  morningDocNumber: null,
  morningInvoiceReceiptNumber: null,
  morningReceiptNumber: null,
} as const;

// ── Payment (receipt line) kinds ────────────────────────────────────────────

export const PAYMENT_KINDS = [
  "BANK_TRANSFER",
  "BIT",
  "PAYBOX",
  "CREDIT_CARD",
  "CASH",
  "CHECK",
  "PAYPAL",
  "PAYONEER",
  "GOOGLE_PAY",
  "APPLE_PAY",
  "GIFT_VOUCHER",
  "OTHER",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Payment apps keep their own (English) names, as in the apps themselves. */
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  BANK_TRANSFER: "העברה בנקאית",
  BIT: "Bit",
  PAYBOX: "PayBox",
  CREDIT_CARD: "כרטיס אשראי",
  CASH: "מזומן",
  CHECK: "המחאה (צ׳ק)",
  PAYPAL: "PayPal",
  PAYONEER: "Payoneer",
  GOOGLE_PAY: "Google Pay",
  APPLE_PAY: "Apple Pay",
  GIFT_VOUCHER: "שובר מתנה",
  OTHER: "אחר",
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
  | "reference"
  | "details";

/** The extra details each payment type asks for (all optional but a cheque's). */
export const PAYMENT_DETAIL_FIELDS: Record<PaymentKind, PaymentDetailField[]> = {
  BANK_TRANSFER: ["bankName", "bankBranch", "bankAccount"],
  CHECK: ["bankName", "bankBranch", "bankAccount", "chequeNumber"],
  CREDIT_CARD: ["cardType", "cardLast4", "dealType", "installments"],
  PAYPAL: ["reference"],
  BIT: ["reference"],
  PAYBOX: ["reference"],
  GOOGLE_PAY: ["reference"],
  APPLE_PAY: ["reference"],
  PAYONEER: [],
  GIFT_VOUCHER: ["reference"],
  OTHER: ["details", "reference"],
  CASH: [],
};

/** The payment apps: their receipt shows a confirmation number. */
const PAYMENT_APPS: readonly PaymentKind[] = ["BIT", "PAYBOX", "GOOGLE_PAY", "APPLE_PAY"];

/** "מספר אישור" on a payment app, as the app calls it. */
export function paymentDetailLabel(method: PaymentKind, field: PaymentDetailField): string {
  if (field === "reference" && PAYMENT_APPS.includes(method)) return "מספר אישור";
  if (field === "reference" && method === "GIFT_VOUCHER") return "מספר שובר";
  return PAYMENT_DETAIL_LABELS[field];
}

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
  details: "פירוט",
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

// ── Draft shape (what the form builds and the action stores) ─────────────────

/** The currencies offered on a document (ISO codes). */
export const DOC_CURRENCIES = ["ILS", "USD", "EUR", "GBP"] as const;
export type DocCurrency = (typeof DOC_CURRENCIES)[number];
export const DOC_CURRENCY_LABELS: Record<DocCurrency, string> = {
  ILS: "₪ שקל",
  USD: "$ דולר",
  EUR: "€ אירו",
  GBP: "£ ליש״ט",
};
const CURRENCY_SYMBOLS: Record<DocCurrency, string> = { ILS: "₪", USD: "$", EUR: "€", GBP: "£" };

export function isDocCurrency(v: string | null | undefined): v is DocCurrency {
  return (DOC_CURRENCIES as readonly string[]).includes(v ?? "");
}

export const DOC_LANGS = ["he", "en"] as const;
export type DocLang = (typeof DOC_LANGS)[number];
export const DOC_LANG_LABELS: Record<DocLang, string> = { he: "עברית", en: "אנגלית" };

/** The document's VAT type. "Mixed" (2) needs a VAT choice per line, so isn't offered. */
export const DOC_VAT_TYPES = [0, 1] as const;
export type DocVatType = (typeof DOC_VAT_TYPES)[number];
export const DOC_VAT_TYPE_LABELS: Record<DocVatType, string> = {
  0: "לפי סוג העסק",
  1: "פטור ממע״מ",
};

export const DOC_ROUNDING_LABELS = { off: "ללא עיגול", on: "עיגול סכומים" } as const;

/** Where a new document's settings bar starts (from Settings, or these). */
export type DocumentDefaults = {
  currency: DocCurrency;
  lang: DocLang;
  vatType: DocVatType;
  rounding: boolean;
};

export function documentDefaults(user: {
  docCurrency?: string | null;
  docLang?: string | null;
  docVatType?: number | null;
  docRounding?: boolean | null;
  vatLiable?: boolean | null;
}): DocumentDefaults {
  return {
    currency: isDocCurrency(user.docCurrency) ? user.docCurrency : "ILS",
    lang: user.docLang === "en" ? "en" : "he",
    // An exempt business has no VAT type to choose
    vatType: user.vatLiable && user.docVatType === 1 ? 1 : 0,
    rounding: !!user.docRounding,
  };
}

/** Agorot (or cents) → "₪1,200.00" in the document's currency. */
export function formatDocMoney(agorot: number, currency: string = "ILS"): string {
  const symbol = isDocCurrency(currency) ? CURRENCY_SYMBOLS[currency] : `${currency} `;
  return `${agorot < 0 ? "−" : ""}${symbol}${Number(agorotToDecimalString(Math.abs(agorot))).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
  /** what an "אחר" payment was, in the practice's own words */
  details?: string | null;
};

export type DocumentDraft = {
  kind: DocKind;
  clientName: string;
  clientTaxId?: string | null;
  /** where the issued document is to be emailed (kept for when the app issues) */
  clientEmails?: string[];
  /** yyyy-mm-dd */
  date: string;
  /** yyyy-mm-dd, tax invoice only */
  dueDate?: string | null;
  /** prices include VAT (VAT-liable business only) */
  vatIncluded: boolean;
  /** ISO code; missing = ILS */
  currency?: string;
  /** missing = Hebrew */
  lang?: string;
  /** the document's VAT type: 0 by business type (or missing), 1 exempt */
  vatType?: number;
  /** round the amounts (applied by the issuing system) */
  rounding?: boolean;
  /** meetings linked to it: internal, never printed */
  sessionIds?: string[];
  description?: string | null;
  items: DraftItem[];
  payments: DraftPayment[];
  remarks?: string | null;
};

/** Several addresses are kept in one text column, comma-separated. */
export function joinEmails(emails: readonly string[] | null | undefined): string | null {
  const clean = (emails ?? []).map((e) => e.trim()).filter(Boolean);
  return clean.length ? clean.join(", ") : null;
}

export function splitEmails(stored: string | null | undefined): string[] {
  return (stored ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** yyyy-mm-dd of the last day of that day's month ("לתשלום עד" starts there). */
export function lastDayOfMonth(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** The name a document goes by; a one-off client has only the printed name. */
export function documentClientName(inv: {
  docClientName?: string | null;
  client?: { firstName: string; lastName: string } | null;
}): string {
  const printed = inv.docClientName?.trim();
  if (printed) return printed;
  if (inv.client) return `${inv.client.firstName} ${inv.client.lastName}`.trim();
  return "לקוח מזדמן";
}

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
  if (!vatLiable || draft.vatType === 1) {
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
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * What stops an unfinished form from being kept as a draft: only having
 * nothing to keep. Everything else waits for preview and issuing, which go
 * through documentProblems.
 */
export function draftSaveProblems(draft: DocumentDraft, vatLiable: boolean): string[] {
  const info = DOC_KINDS[draft.kind];
  if (info.vatLiableOnly && !vatLiable) {
    return [`${info.label} מפיק רק עוסק מורשה. בהגדרות העסק מסומן עוסק פטור.`];
  }
  const hasContent =
    !!draft.clientName.trim() ||
    draft.items.some((it) => it.description.trim() || it.unitPriceAgorot > 0) ||
    draft.payments.some((p) => p.amountAgorot > 0) ||
    !!draft.remarks?.trim();
  const problems: string[] = [];
  if (!hasContent) problems.push("אין עדיין מה לשמור: ממלאים שם לקוח/ה או שורה במסמך.");
  if (!DATE_RE.test(draft.date)) problems.push("חסר תאריך מסמך.");
  return problems;
}

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
  for (const e of draft.clientEmails ?? []) {
    if (!EMAIL_RE.test(e.trim())) problems.push(`כתובת המייל ${e.trim()} אינה תקינה.`);
  }

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
      `סכום התקבולים (${formatDocMoney(totals.paymentsAgorot, draft.currency)}) צריך להיות שווה לסכום המסמך (${formatDocMoney(totals.totalAgorot, draft.currency)}).`,
    );
  }
  return problems;
}

// ── Issuing elsewhere by hand ───────────────────────────────────────────────

/**
 * Plain-text summary of a draft, to copy into the system where the official
 * document is issued (until the app issues documents itself).
 */
export function documentCopyText(draft: DocumentDraft, vatLiable: boolean): string {
  const info = DOC_KINDS[draft.kind];
  const totals = documentTotals(draft, vatLiable);
  const ils = (a: number) =>
    `${isDocCurrency(draft.currency) ? CURRENCY_SYMBOLS[draft.currency] : "₪"}${agorotToDecimalString(a)}`;
  const lines: string[] = [`${info.label}`, `לקוח/ה: ${draft.clientName}`];
  if (draft.clientTaxId) lines.push(`ת״ז / ח״פ: ${draft.clientTaxId}`);
  lines.push(`תאריך: ${draft.date}`);
  if (info.hasDueDate && draft.dueDate) lines.push(`לתשלום עד: ${draft.dueDate}`);
  if (draft.clientEmails?.length) lines.push(`מייל: ${draft.clientEmails.join(", ")}`);
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
          return `${paymentDetailLabel(p.method, f)}: ${shown}`;
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
