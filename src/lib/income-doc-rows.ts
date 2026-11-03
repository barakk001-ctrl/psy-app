// The income documents list as display rows, the one place that loads it: the
// page's first render and the filters' /api/invoices/documents both come here,
// so a filter in place shows exactly what a full page load would. Every value
// is formatted on the server, so the browser only prints it.

import type { InvoiceStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { documentClientName, docTypeLabel } from "@/lib/billing-docs";
import { clinicDay } from "@/lib/billing-doc-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { MAX_DOC_ROWS } from "@/lib/income-doc-limits";
import { docListWhere, groupByMonth, isCreditNote, type DocListFilters, type MonthGroup } from "@/lib/income-doc-list";

export type DocRow = {
  id: string;
  /** null = an older app invoice, shown by its number */
  typeLabel: string | null;
  docNumber: string | null;
  oldNumber: string;
  clientName: string;
  date: string;
  status: InvoiceStatus;
  credit: boolean;
  /** a credit note's reads as going back */
  amount: string;
  /** set only for a part-paid document */
  balance: string | null;
};

export type DocMonths = { months: MonthGroup<DocRow>[]; capped: boolean };

/** Newest first, under their months. */
export async function loadDocMonths(where: Prisma.InvoiceWhereInput): Promise<DocMonths> {
  const rows = await db.invoice.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    take: MAX_DOC_ROWS,
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  const shown = rows.map((inv) => {
    const total = Number(inv.total);
    const balance = total - Number(inv.amountPaid);
    const credit = isCreditNote(inv.docType);
    const row: DocRow = {
      id: inv.id,
      typeLabel: inv.docType != null ? docTypeLabel(inv.docType) : null,
      docNumber: inv.morningDocNumber,
      oldNumber: `#${String(inv.number).padStart(4, "0")}`,
      clientName: inv.docClientName || inv.clientId ? documentClientName(inv) : "ללא שם עדיין",
      date: formatDate(inv.issueDate),
      status: inv.status,
      credit,
      amount: `${credit ? "−" : ""}${formatCurrency(total, inv.currency)}`,
      balance: !credit && balance > 0 && balance !== total ? formatCurrency(balance, inv.currency) : null,
    };
    return { row, day: clinicDay(inv.issueDate) };
  });
  const months = groupByMonth(shown, (s) => s.day).map((m) => ({
    key: m.key,
    label: m.label,
    rows: m.rows.map((s) => s.row),
  }));
  return { months, capped: rows.length === MAX_DOC_ROWS };
}

/** The documents tab for these filters. */
export function loadFilteredDocuments(userId: string, filters: DocListFilters, today: string): Promise<DocMonths> {
  return loadDocMonths(docListWhere(userId, { ...filters, view: "documents" }, today));
}
