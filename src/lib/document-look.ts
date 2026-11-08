// How the practice's income documents look, and what goes with them (Settings
// → הגדרות מסמכים): template and color, the signature image, the email text
// for the client, and the number each document type will get next. Pure,
// tested in document-look.test.ts. Used by the preview, the draft PDF and the
// settings cards; the numbering waits for issuing from the app.

import { DOC_KINDS, type DocKind, type DocumentDraft } from "@/lib/billing-docs";

// ── Template and color ──────────────────────────────────────────────────────

export const DOC_TEMPLATES = ["classic", "band", "minimal"] as const;
export type DocTemplate = (typeof DOC_TEMPLATES)[number];

export const DOC_TEMPLATE_LABELS: Record<DocTemplate, string> = {
  classic: "קלאסי",
  band: "פס צבע",
  minimal: "נקי",
};

export const DOC_TEMPLATE_HINTS: Record<DocTemplate, string> = {
  classic: "פרטי העסק מימין, פרטי המסמך משמאל, קו צבע מתחת",
  band: "פס צבע מלא בראש המסמך, עם פרטי העסק בלבן",
  minimal: "כותרת ממורכזת וקווים דקים",
};

/** A small palette: all dark enough for white text on the "band" template (≥ 4.5:1). */
export const DOC_COLORS = {
  sage: { label: "ירוק מרווה", hex: "#4E6B4B" },
  navy: { label: "כחול לילה", hex: "#2E4A6B" },
  terracotta: { label: "טרקוטה", hex: "#9A4A32" },
  plum: { label: "שזיף", hex: "#6A4766" },
  graphite: { label: "גרפיט", hex: "#3D3D3D" },
} as const;
export type DocColor = keyof typeof DOC_COLORS;
export const DOC_COLOR_KEYS = Object.keys(DOC_COLORS) as DocColor[];

export type DocLook = { template: DocTemplate; color: DocColor };

export const DEFAULT_DOC_LOOK: DocLook = { template: "classic", color: "sage" };

export function isDocTemplate(v: unknown): v is DocTemplate {
  return typeof v === "string" && (DOC_TEMPLATES as readonly string[]).includes(v);
}

export function isDocColor(v: unknown): v is DocColor {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DOC_COLORS, v);
}

/** The stored choice, or the default for anything unknown. */
export function docLook(user: { docTemplate?: string | null; docColor?: string | null }): DocLook {
  return {
    template: isDocTemplate(user.docTemplate) ? user.docTemplate : DEFAULT_DOC_LOOK.template,
    color: isDocColor(user.docColor) ? user.docColor : DEFAULT_DOC_LOOK.color,
  };
}

/** WCAG contrast ratio of two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A light tint of the color for table headers ("#rrggbb" mixed with white). */
export function tint(hex: string, amount = 0.88): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

// ── Signature image ─────────────────────────────────────────────────────────

/** The browser scales the picked image into this box (keeping transparency). */
export const SIGNATURE_MAX_WIDTH = 600;
export const SIGNATURE_MAX_HEIGHT = 240;
export const SIGNATURE_MAX_CHARS = 300_000;

// PNG or JPEG only: the PDF renderer can't read WebP
const SIGNATURE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

/** The server's guard: what arrives really is a small PNG/JPEG data: URL. */
export function isValidSignatureDataUrl(value: string): boolean {
  return value.length <= SIGNATURE_MAX_CHARS && SIGNATURE_RE.test(value);
}

// ── Email to the client ─────────────────────────────────────────────────────

/** The placeholders the subject and message may hold, filled in when sending. */
export const EMAIL_PLACEHOLDERS = {
  client: "{שם הלקוח}",
  docType: "{סוג המסמך}",
  number: "{מספר המסמך}",
  amount: "{סכום}",
  business: "{שם העסק}",
} as const;

export const DEFAULT_EMAIL_SUBJECT = "{סוג המסמך} מספר {מספר המסמך} – {שם העסק}";

// Lines, not one string with \n: easier to read here, joined where used
export const DEFAULT_EMAIL_BODY = [
  "שלום {שם הלקוח},",
  "",
  "מצורף המסמך: {סוג המסמך} מספר {מספר המסמך}, על סך {סכום}.",
  "",
  "תודה,",
  "{שם העסק}",
].join("\n");

export const EMAIL_SUBJECT_MAX = 150;
export const EMAIL_BODY_MAX = 2000;

export type EmailValues = {
  client: string;
  docType: string;
  number: string;
  amount: string;
  business: string;
};

/** The subject or message with the placeholders filled in. Unknown braces stay as typed. */
export function fillEmailTemplate(template: string, values: EmailValues): string {
  let out = template;
  for (const key of Object.keys(EMAIL_PLACEHOLDERS) as (keyof EmailValues)[]) {
    out = out.split(EMAIL_PLACEHOLDERS[key]).join(values[key]);
  }
  return out;
}

/** What is stored: null when it is the default (so a better default reaches everyone). */
export function storedEmailText(value: string, fallback: string): string | null {
  const v = value.replace(/\r\n/g, "\n").trim();
  return v === "" || v === fallback ? null : v;
}

export function emailTexts(user: { docEmailSubject?: string | null; docEmailBody?: string | null }) {
  return {
    subject: user.docEmailSubject?.trim() || DEFAULT_EMAIL_SUBJECT,
    body: user.docEmailBody?.trim() || DEFAULT_EMAIL_BODY,
  };
}

// ── Numbering ───────────────────────────────────────────────────────────────

/** The column holding the next number of each document type. */
export const NEXT_NUMBER_FIELDS = {
  TAX_INVOICE: "docNextTaxInvoice",
  TAX_INVOICE_RECEIPT: "docNextTaxInvoiceReceipt",
  RECEIPT: "docNextReceipt",
  CREDIT_NOTE: "docNextCreditNote",
} as const satisfies Record<DocKind, string>;

export type NextNumberField = (typeof NEXT_NUMBER_FIELDS)[DocKind];

/** In the order the settings card lists them. */
export const NUMBERED_KINDS: DocKind[] = ["TAX_INVOICE", "TAX_INVOICE_RECEIPT", "RECEIPT", "CREDIT_NOTE"];

export const MAX_DOC_NUMBER = 999_999_999;

/** "20017" → 20017; anything but a whole number from 1 to MAX_DOC_NUMBER → null. */
export function parseNextNumber(raw: string): number | null {
  const v = raw.trim();
  if (!/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= MAX_DOC_NUMBER ? n : null;
}

export function nextNumberLabel(kind: DocKind): string {
  return DOC_KINDS[kind].label;
}

// ── The settings cards' example ─────────────────────────────────────────────

/** A made-up document for the live previews in Settings (no real data). */
export function sampleDocumentDraft(vatLiable: boolean, today: string): DocumentDraft {
  return {
    kind: vatLiable ? "TAX_INVOICE_RECEIPT" : "RECEIPT",
    clientName: "לקוח/ה לדוגמה",
    clientTaxId: "000000018",
    date: today,
    vatIncluded: true,
    currency: "ILS",
    description: vatLiable ? null : "פגישה טיפולית",
    items: vatLiable ? [{ description: "פגישה טיפולית", quantity: 1, unitPriceAgorot: 45000 }] : [],
    payments: [{ method: "BIT", date: today, amountAgorot: 45000, reference: "123456" }],
    remarks: "תודה!",
  };
}
