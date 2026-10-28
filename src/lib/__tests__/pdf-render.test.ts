import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderPdf } from "@/components/invoices/invoice-pdf";
import { SummariesPDF, type SummariesPdfData } from "@/components/clients/summaries-pdf";
import { IncomePDF, type IncomePdfData } from "@/components/reports/income-pdf";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

// Made-up data, shaped like what the routes pass. The server renders PDFs one
// after another in the same Node process: a summaries PDF used to leave
// fontkit's shared glyph cache with glyphs (e.g. ".") that had lost their code
// points, and every later income report — RTL amounts like "‏0.00 ‏₪" — failed
// in textkit's bidi reordering until the process restarted.

const now = new Date("2026-10-28T10:00:00Z");

const summaries: SummariesPdfData = {
  practiceName: "קליניקה לדוגמה",
  clientName: "בדיקה דמיונית",
  clientIdNumber: null,
  generatedAt: formatDate(now),
  entries: [
    { date: formatDateTime(now), tag: "טיפול פרטני", text: "סיכום בדיקה מקומי — טקסט דמיוני." },
    { date: formatDateTime(now), tag: "טיפול פרטני", text: "שורה עם English ו-123.\nשורה שנייה." },
  ],
};

const zero = formatCurrency(0);
const income: IncomePdfData = {
  practiceName: "קליניקה לדוגמה",
  periodLabel: "2026",
  generatedAt: formatDate(now),
  received: zero,
  expected: formatCurrency(1500),
  held: 0,
  cancelled: 0,
  receivedFromSessions: zero,
  receivedFromInvoices: zero,
  hasInvoicePayments: false,
  clients: [{ name: "בדיקה דמיונית", held: 0, expected: formatCurrency(1500), received: zero }],
  methods: [],
  sessions: [
    { date: "29.10.26 17:00", client: "בדיקה דמיונית", status: "מתוכננת", rate: formatCurrency(300), paid: "—", method: "" },
  ],
  invoicePayments: [],
};

const isPdf = (b: Uint8Array) => Buffer.from(b).subarray(0, 5).toString() === "%PDF-";
// The components render a <Document>; renderToBuffer's type wants that element type
const doc = (el: unknown) => el as ReactElement<DocumentProps>;
const summariesPdf = () => renderPdf(() => renderToBuffer(doc(createElement(SummariesPDF, { data: summaries }))));
const incomePdf = () => renderPdf(() => renderToBuffer(doc(createElement(IncomePDF, { data: income }))));

describe("PDFs rendered in one process", () => {
  it("an income report renders after a summaries PDF, and the other way round", async () => {
    expect(isPdf(await summariesPdf())).toBe(true);
    expect(isPdf(await incomePdf())).toBe(true);
    expect(isPdf(await summariesPdf())).toBe(true);
    expect(isPdf(await incomePdf())).toBe(true);
  }, 60_000);

  it("renders requested at the same time are queued, not interleaved", async () => {
    const results = await Promise.all([summariesPdf(), incomePdf(), summariesPdf(), incomePdf()]);
    expect(results.every(isPdf)).toBe(true);
  }, 60_000);

  it("a failed render doesn't block the next one", async () => {
    await expect(renderPdf(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(isPdf(await incomePdf())).toBe(true);
  }, 60_000);
});
