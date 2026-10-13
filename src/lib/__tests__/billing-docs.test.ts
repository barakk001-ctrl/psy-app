import { describe, expect, it } from "vitest";
import {
  DOC_KINDS,
  agorotToDecimalString,
  canCreditNote,
  creatableKinds,
  defaultKind,
  docTypeLabel,
  documentProblems,
  documentTotals,
  lineAgorot,
  morningCopyText,
  morningNewDocumentUrl,
  parseAgorot,
  type DocumentDraft,
} from "@/lib/billing-docs";

const base: DocumentDraft = {
  kind: "TAX_INVOICE_RECEIPT",
  clientName: "דנה כהן",
  clientTaxId: "000000018",
  date: "2026-10-14",
  vatIncluded: true,
  items: [{ description: "פגישת טיפול", quantity: 1, unitPriceAgorot: 47200 }],
  payments: [{ method: "BIT", date: "2026-10-14", amountAgorot: 47200 }],
};

describe("money", () => {
  it("parses typed amounts into agorot without floats", () => {
    expect(parseAgorot("350")).toBe(35000);
    expect(parseAgorot("350.5")).toBe(35050);
    expect(parseAgorot("1,200.05")).toBe(120005);
    expect(parseAgorot("₪ 0.1")).toBe(10);
    expect(parseAgorot("")).toBeNull();
    expect(parseAgorot("-5")).toBeNull();
    expect(parseAgorot("1.234")).toBeNull();
    expect(parseAgorot("abc")).toBeNull();
  });
  it("formats agorot", () => {
    expect(agorotToDecimalString(35050)).toBe("350.50");
    expect(agorotToDecimalString(5)).toBe("0.05");
    expect(agorotToDecimalString(-120)).toBe("-1.20");
  });
  it("multiplies quantity × price to the agora", () => {
    expect(lineAgorot({ quantity: 1.5, unitPriceAgorot: 33333 })).toBe(50000);
    expect(lineAgorot({ quantity: 3, unitPriceAgorot: 45000 })).toBe(135000);
    // 0.1 + 0.2 style float traps don't leak in
    expect(lineAgorot({ quantity: 0.3, unitPriceAgorot: 10 })).toBe(3);
  });
});

describe("kinds", () => {
  it("offers tax documents only to a VAT-liable business", () => {
    expect(creatableKinds(false).map((k) => k.code)).toEqual([400]);
    expect(creatableKinds(true).map((k) => k.code)).toEqual([320, 305, 400]);
  });
  it("starts on the Settings preference when it's allowed", () => {
    expect(defaultKind(true, 400)).toBe("RECEIPT");
    expect(defaultKind(true, 320)).toBe("TAX_INVOICE_RECEIPT");
    expect(defaultKind(false, 320)).toBe("RECEIPT");
    expect(defaultKind(true, null)).toBe("TAX_INVOICE_RECEIPT");
  });
  it("labels stored documents, including older app invoices", () => {
    expect(docTypeLabel(330)).toBe("חשבונית זיכוי");
    expect(docTypeLabel(null)).toBe("חשבונית (דרישת תשלום)");
  });
  it("credits only issued tax invoices", () => {
    expect(canCreditNote({ docType: 305, morningDocId: "x", status: "SENT" })).toBe(true);
    expect(canCreditNote({ docType: 320, morningDocId: "x", status: "PAID" })).toBe(true);
    expect(canCreditNote({ docType: 320, morningDocId: null, status: "PAID" })).toBe(false);
    expect(canCreditNote({ docType: 400, morningDocId: "x", status: "PAID" })).toBe(false);
    expect(canCreditNote({ docType: 305, morningDocId: "x", status: "CANCELLED" })).toBe(false);
  });
});

describe("documentTotals", () => {
  it("carves VAT out of VAT-inclusive prices", () => {
    const t = documentTotals(base, true);
    expect(t.totalAgorot).toBe(47200);
    expect(t.netAgorot).toBe(40000);
    expect(t.vatAgorot).toBe(7200);
  });
  it("adds VAT on top when prices exclude it", () => {
    const t = documentTotals(
      { ...base, vatIncluded: false, items: [{ description: "x", quantity: 2, unitPriceAgorot: 40000 }] },
      true,
    );
    expect(t.netAgorot).toBe(80000);
    expect(t.vatAgorot).toBe(14400);
    expect(t.totalAgorot).toBe(94400);
  });
  it("shows no VAT for an exempt business", () => {
    const t = documentTotals({ ...base, vatIncluded: false }, false);
    expect(t.vatAgorot).toBe(0);
    expect(t.totalAgorot).toBe(47200);
  });
  it("totals a receipt from what was received", () => {
    const t = documentTotals(
      {
        ...base,
        kind: "RECEIPT",
        items: [{ description: "ignored", quantity: 1, unitPriceAgorot: 1 }],
        payments: [
          { method: "BANK_TRANSFER", date: "2026-10-14", amountAgorot: 45000 },
          { method: "CASH", date: "2026-10-14", amountAgorot: 5000 },
        ],
      },
      true,
    );
    expect(t.totalAgorot).toBe(50000);
    expect(t.vatAgorot).toBe(0);
  });
});

describe("documentProblems", () => {
  it("accepts a balanced invoice-receipt", () => {
    expect(documentProblems(base, true)).toEqual([]);
  });
  it("needs receipts to match the invoice-receipt's total", () => {
    const p = documentProblems(
      { ...base, payments: [{ method: "BIT", date: "2026-10-14", amountAgorot: 40000 }] },
      true,
    );
    expect(p.join(" ")).toContain("סכום התקבולים (₪400.00)");
  });
  it("refuses tax documents for an exempt business", () => {
    expect(documentProblems(base, false)[0]).toContain("עוסק מורשה");
  });
  it("requires receipt lines on a receipt and lines on an invoice", () => {
    expect(documentProblems({ ...base, kind: "RECEIPT", payments: [] }, false)).toContain(
      "יש להוסיף לפחות תקבול אחד.",
    );
    expect(documentProblems({ ...base, kind: "TAX_INVOICE", items: [] }, true)).toContain(
      "יש להוסיף לפחות שורה אחת בפירוט ההכנסות.",
    );
  });
  it("checks payment details", () => {
    const p = documentProblems(
      {
        ...base,
        kind: "RECEIPT",
        payments: [
          { method: "CREDIT_CARD", date: "2026-10-14", amountAgorot: 100, cardLast4: "12a4", installments: 0 },
        ],
      },
      false,
    );
    expect(p).toContain("בתקבול 1 יש להקליד בדיוק 4 ספרות של הכרטיס.");
    expect(p).toContain("בתקבול 1 מספר התשלומים אינו תקין.");
  });
  it("needs the cheque details morning requires", () => {
    const cheque = { method: "CHECK" as const, date: "2026-10-14", amountAgorot: 100 };
    expect(documentProblems({ ...base, kind: "RECEIPT", payments: [cheque] }, false).join(" ")).toContain(
      "(המחאה) יש למלא בנק",
    );
    expect(
      documentProblems(
        {
          ...base,
          kind: "RECEIPT",
          payments: [{ ...cheque, bankName: "12", bankBranch: "600", bankAccount: "1234", chequeNumber: "55" }],
        },
        false,
      ),
    ).toEqual([]);
  });
  it("needs a client name and date", () => {
    const p = documentProblems({ ...base, clientName: " ", date: "" }, true);
    expect(p).toContain("חסר שם הלקוח/ה על המסמך.");
    expect(p).toContain("חסר תאריך מסמך.");
  });
});

describe("issuing by hand in morning", () => {
  it("opens morning's new-document screen for the type", () => {
    expect(morningNewDocumentUrl("RECEIPT")).toBe(
      "https://app.greeninvoice.co.il/incomes/documents/new/400",
    );
    expect(morningNewDocumentUrl("TAX_INVOICE")).toContain("/new/305");
    expect(DOC_KINDS.CREDIT_NOTE.code).toBe(330);
  });
  it("summarises the document to paste", () => {
    const text = morningCopyText(
      {
        ...base,
        kind: "RECEIPT",
        payments: [
          {
            method: "BANK_TRANSFER",
            date: "2026-10-14",
            amountAgorot: 45000,
            bankName: "לאומי",
            bankBranch: "800",
            bankAccount: "123456",
          },
        ],
        remarks: "תודה",
      },
      false,
    );
    expect(text).toContain("קבלה");
    expect(text).toContain("לקוח/ה: דנה כהן");
    expect(text).toContain("• העברה בנקאית ₪450.00 (2026-10-14) — בנק: לאומי, סניף: 800, מספר חשבון: 123456");
    expect(text).toContain("סה״כ: ₪450.00");
    expect(text).not.toContain("פגישת טיפול"); // a receipt has no item lines
  });
});
