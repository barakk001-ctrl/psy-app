// "מסמכי הוצאות": a file the practitioner uploads and the details she fills in
// below it. Pure and tested; the actions and pages do the rest. Nothing here
// reads the file: no OCR, she types the details.

import { parseAgorot } from "@/lib/billing-docs";

/** morning's expense document types, so the words match what she knows. */
export const EXPENSE_DOC_TYPES = [
  { code: 305, label: "חשבונית מס" },
  { code: 320, label: "חשבונית מס / קבלה" },
  { code: 400, label: "קבלה" },
  { code: 330, label: "חשבונית זיכוי" },
  { code: 20, label: "חשבון / אישור תשלום" },
  { code: 405, label: "קבלה על תרומה" },
] as const;

const CREDIT_NOTE_CODE = 330;

export function expenseDocTypeLabel(code: number | null | undefined): string {
  return EXPENSE_DOC_TYPES.find((t) => t.code === code)?.label ?? "מסמך הוצאה";
}

export type ExpenseStatus = "DRAFT" | "APPROVED";

export type ExpenseDetails = {
  docType: number | null;
  /** yyyy-mm-dd */
  docDate: string;
  supplier: string;
  docNumber: string;
  /** as typed */
  amount: string;
  vatAmount: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** What stops an expense from being approved (a draft can stay unfinished). */
export function expenseProblems(d: ExpenseDetails): string[] {
  const problems: string[] = [];
  if (!EXPENSE_DOC_TYPES.some((t) => t.code === d.docType)) problems.push("יש לבחור את סוג המסמך.");
  if (!DAY_RE.test(d.docDate)) problems.push("חסר תאריך המסמך.");
  if (!d.supplier.trim()) problems.push("חסר שם הספק.");
  const amount = parseAgorot(d.amount);
  if (amount === null || amount <= 0) problems.push("סכום המסמך חייב להיות גדול מאפס.");
  const vat = d.vatAmount.trim() ? parseAgorot(d.vatAmount) : 0;
  if (vat === null) problems.push("סכום המע״מ אינו תקין.");
  else if (amount !== null && vat > amount) problems.push("המע״מ לא יכול להיות גדול מסכום המסמך.");
  return problems;
}

/** Amounts that can be stored even on a draft: unreadable ones are simply left out. */
export function draftAmount(raw: string): number | null {
  return raw.trim() ? parseAgorot(raw) : null;
}

/** What an expense adds to its month. A credit note gives money back. */
export function expenseMonthAgorot(e: { docType: number | null; amountAgorot: number }): number {
  return e.docType === CREDIT_NOTE_CODE ? -e.amountAgorot : e.amountAgorot;
}

export function monthTotalAgorot(rows: { docType: number | null; amountAgorot: number }[]): number {
  return rows.reduce((s, e) => s + expenseMonthAgorot(e), 0);
}
