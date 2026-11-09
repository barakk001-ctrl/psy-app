// The income lines of "מסמך חדש" ("פירוט הכנסות") as the form edits them.
//
// A line is edited in place and confirmed with "אישור" (or Enter), which
// folds it into one read-only line with "עריכה" / "מחיקה". Confirming is only
// a display state: whatever is typed is part of the document whether or not it
// was confirmed, so saving, previewing or issuing never loses a line. The one
// thing left out is a line nobody touched, e.g. the blank line "הוספת שורה"
// opened, or the one a new form starts with.

import { lineAgorot, parseAgorot, type DraftItem } from "@/lib/billing-docs";

export type LineRow = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  /** folded into the read-only line */
  confirmed: boolean;
  /** opened blank and never edited since: not part of the document */
  fresh: boolean;
};

/** Quantity as a number, or null if it isn't a positive number. */
function quantityOf(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** "אישור" is allowed: a description, a quantity above zero and a price. */
export function lineReady(row: Pick<LineRow, "description" | "quantity" | "unitPrice">): boolean {
  return !!row.description.trim() && quantityOf(row.quantity) !== null && parseAgorot(row.unitPrice) !== null;
}

/** The line as the document holds it (the same conversion the form always used). */
export function lineToItem(row: Pick<LineRow, "description" | "quantity" | "unitPrice">): DraftItem {
  return {
    description: row.description,
    quantity: Number(row.quantity) || 0,
    unitPriceAgorot: parseAgorot(row.unitPrice) ?? 0,
  };
}

/** Quantity × price of one line, in agorot. */
export function lineTotalAgorot(row: Pick<LineRow, "quantity" | "unitPrice">): number {
  return lineAgorot({ quantity: Number(row.quantity) || 0, unitPriceAgorot: parseAgorot(row.unitPrice) ?? 0 });
}

/** A blank line ready to be filled (`rate` = the client's rate, prefilled). */
export function newLine(key: string, rate?: string | null): LineRow {
  return { key, description: "", quantity: "1", unitPrice: rate ?? "", confirmed: false, fresh: true };
}

/** A line that already holds data (a saved draft, a credited document): confirmed when complete. */
export function existingLine(key: string, item: Pick<LineRow, "description" | "quantity" | "unitPrice">): LineRow {
  return { key, ...item, confirmed: lineReady(item), fresh: false };
}

/** Typing in a line: it now counts, and an edited line is open again. */
export function updateLine(rows: LineRow[], key: string, patch: Partial<Pick<LineRow, "description" | "quantity" | "unitPrice">>): LineRow[] {
  return rows.map((r) => (r.key === key ? { ...r, ...patch, fresh: false } : r));
}

/** "אישור": folds the line, only when it is complete. */
export function confirmLine(rows: LineRow[], key: string): LineRow[] {
  return rows.map((r) => (r.key === key && lineReady(r) ? { ...r, confirmed: true, fresh: false } : r));
}

/** "עריכה": opens a confirmed line again, with everything it held. */
export function editLine(rows: LineRow[], key: string): LineRow[] {
  return rows.map((r) => (r.key === key ? { ...r, confirmed: false } : r));
}

/** "מחיקה": removes the line; the last one is replaced by a blank line, so there is always one to fill. */
export function deleteLine(rows: LineRow[], key: string, blank: () => LineRow): LineRow[] {
  const left = rows.filter((r) => r.key !== key);
  return left.length ? left : [blank()];
}

/** The lines that go into the document: everything except untouched blank lines. */
export function linesForDocument(rows: LineRow[]): DraftItem[] {
  return rows.filter((r) => r.confirmed || !r.fresh).map(lineToItem);
}
