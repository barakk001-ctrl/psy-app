import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderPdf } from "@/components/invoices/invoice-pdf";
import { DocumentPDF, type DocumentPdfData } from "@/components/invoices/document-pdf";
import { DOC_TEMPLATES, sampleDocumentDraft } from "@/lib/document-look";
import type { DocumentDraft } from "@/lib/billing-docs";

// The draft PDF of a "מסמך חדש" document, in every template, with made-up data:
// Hebrew with English and numbers, several lines of notes, receipts and items.

// A 1×1 transparent PNG, standing in for a signature image
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const business: DocumentPdfData["business"] = {
  name: "קליניקה לדוגמה",
  occupation: "פסיכולוגיה קלינית",
  description: "טיפול רגשי למבוגרים, English and 123",
  businessId: "000000018",
  address: "רחוב הדוגמה 1, תל אביב",
  phone: "050-0000000",
  email: "clinic@example.test",
  website: "www.example.test",
  vatLiable: true,
  logoUrl: PNG,
  signatureUrl: PNG,
};

const isPdf = (b: Uint8Array) => Buffer.from(b).subarray(0, 5).toString() === "%PDF-";
const render = (data: DocumentPdfData) =>
  renderPdf(() => renderToBuffer(createElement(DocumentPDF, { data }) as unknown as ReactElement<DocumentProps>));

describe("the draft PDF of a document", () => {
  it.each(DOC_TEMPLATES)("renders in the %s template", async (template) => {
    const draft: DocumentDraft = {
      ...sampleDocumentDraft(true, "2026-11-08"),
      dueDate: "2026-11-30",
      remarks: "שורה ראשונה עם English 42.\nשורה שנייה.",
    };
    const pdf = await render({
      draft,
      business: { ...business, look: { template, color: "navy" } },
      number: null,
      status: "draft",
      producedAt: "08/11/2026 10:00",
    });
    expect(isPdf(pdf)).toBe(true);
  });

  it("renders a receipt with a recorded number and no logo or signature", async () => {
    const pdf = await render({
      draft: sampleDocumentDraft(false, "2026-11-08"),
      business: { ...business, vatLiable: false, logoUrl: null, signatureUrl: null },
      number: "20017",
      status: "issued",
      producedAt: "08/11/2026 10:00",
    });
    expect(isPdf(pdf)).toBe(true);
  });
});
