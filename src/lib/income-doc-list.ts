// The "מסמכי הכנסות" list: which tab, which period, type and status, all in the
// URL so back and refresh keep them. Pure and tested; the page does the DB call.

import type { Prisma } from "@prisma/client";
import { DOC_KINDS, HAS_DOCUMENT_NUMBER, NO_DOCUMENT_NUMBER, docKindSquares } from "@/lib/billing-docs";

export type DocView = "documents" | "drafts";

export type DocPeriod = "month" | "12m" | "all" | "custom";
export const DOC_PERIODS: { key: DocPeriod; label: string }[] = [
  { key: "month", label: "חודש אחרון" },
  { key: "12m", label: "12 חודשים אחרונים" },
  { key: "all", label: "הכול" },
  { key: "custom", label: "טווח תאריכים" },
];

export type DocStatusFilter = "all" | "open" | "paid" | "cancelled";
export const DOC_STATUS_FILTERS: { key: DocStatusFilter; label: string }[] = [
  { key: "all", label: "כל הסטטוסים" },
  { key: "open", label: "פתוח" },
  { key: "paid", label: "שולם" },
  { key: "cancelled", label: "בוטל" },
];

export const DOC_TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "כל הסוגים" },
  ...docKindSquares(true).map((k) => ({ key: String(k.code), label: k.label })),
];

export type DocListFilters = {
  view: DocView;
  period: DocPeriod;
  /** yyyy-mm-dd, kept only for a custom range */
  from: string;
  to: string;
  /** a document-type code, or "all" */
  type: string;
  status: DocStatusFilter;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDocListFilters(params: {
  view?: string;
  period?: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
}): DocListFilters {
  const period = DOC_PERIODS.some((p) => p.key === params.period) ? (params.period as DocPeriod) : "12m";
  const from = period === "custom" && DAY_RE.test(params.from ?? "") ? params.from! : "";
  const to = period === "custom" && DAY_RE.test(params.to ?? "") ? params.to! : "";
  return {
    view: params.view === "drafts" ? "drafts" : "documents",
    period,
    from,
    to,
    type: DOC_TYPE_FILTERS.some((t) => t.key === params.type) ? params.type! : "all",
    status: DOC_STATUS_FILTERS.some((s) => s.key === params.status) ? (params.status as DocStatusFilter) : "all",
  };
}

/** The address of these filters, leaving defaults out. */
export function docListHref(f: DocListFilters): string {
  const q = new URLSearchParams();
  if (f.view === "drafts") q.set("view", "drafts");
  if (f.period !== "12m") q.set("period", f.period);
  if (f.period === "custom" && f.from) q.set("from", f.from);
  if (f.period === "custom" && f.to) q.set("to", f.to);
  if (f.type !== "all") q.set("type", f.type);
  if (f.status !== "all") q.set("status", f.status);
  const s = q.toString();
  return s ? `/invoices?${s}` : "/invoices";
}

/** yyyy-mm-dd `months` calendar months earlier; the 31st lands on the month's last day. */
export function monthsBefore(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 - months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 - months, Math.min(d, last))).toISOString().slice(0, 10);
}

const dayDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * An unissued document: a saved draft, in the drafts tab. A draft that was
 * cancelled is in neither tab; it never was a document.
 */
const DRAFT_WHERE: Prisma.InvoiceWhereInput = {
  docType: { not: null },
  ...NO_DOCUMENT_NUMBER,
  status: { not: "CANCELLED" },
};

/** What the documents tab lists: older app invoices as they are, and documents with a number. */
export const LISTED_DOCUMENT: Prisma.InvoiceWhereInput = {
  OR: [{ docType: null }, HAS_DOCUMENT_NUMBER],
};

export function draftsWhere(userId: string): Prisma.InvoiceWhereInput {
  return { userId, ...DRAFT_WHERE };
}

/** `today` is yyyy-mm-dd on the clinic calendar. Documents store their day at UTC midnight. */
export function docListWhere(userId: string, f: DocListFilters, today: string): Prisma.InvoiceWhereInput {
  if (f.view === "drafts") return draftsWhere(userId);
  const from =
    f.period === "month"
      ? monthsBefore(today, 1)
      : f.period === "12m"
        ? monthsBefore(today, 12)
        : f.period === "custom"
          ? f.from
          : "";
  const to = f.period === "custom" ? f.to : "";
  const status =
    f.status === "open"
      ? { in: ["SENT", "PARTIALLY_PAID"] as ("SENT" | "PARTIALLY_PAID")[] }
      : f.status === "paid"
        ? ("PAID" as const)
        : f.status === "cancelled"
          ? ("CANCELLED" as const)
          : undefined;
  return {
    userId,
    // Older app invoices have no type and are documents as they are
    ...LISTED_DOCUMENT,
    ...(f.type !== "all" ? { docType: Number(f.type) } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? { issueDate: { ...(from ? { gte: dayDate(from) } : {}), ...(to ? { lte: dayDate(to) } : {}) } }
      : {}),
  };
}

export type MonthGroup<T> = { key: string; label: string; rows: T[] };

/** "אוקטובר 2026" for a yyyy-mm key. */
export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}-01T00:00:00.000Z`),
  );
}

/** Rows (already newest first) under their month, in the order they come. */
export function groupByMonth<T>(rows: T[], dayOf: (row: T) => string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const row of rows) {
    const key = dayOf(row).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.rows.push(row);
    else groups.push({ key, label: monthLabel(key), rows: [row] });
  }
  return groups;
}

/** A credit note's amount reads as money going back. */
export const isCreditNote = (docType: number | null) => docType === DOC_KINDS.CREDIT_NOTE.code;
