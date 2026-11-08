import { describe, expect, it } from "vitest";
import {
  DOC_KINDS,
  documentDefaults,
  isUnissuedDocument,
  paymentDetailLabel,
  agorotToDecimalString,
  canCreditNote,
  creatableKinds,
  defaultKind,
  docKindSquares,
  docTypeLabel,
  documentClientName,
  documentProblems,
  documentTotals,
  draftSaveProblems,
  formatDocMoney,
  joinEmails,
  lastDayOfMonth,
  lineAgorot,
  documentCopyText,
  splitEmails,
  parseAgorot,
  PAYMENT_DETAIL_FIELDS,
  PAYMENT_KINDS,
  PAYMENT_KIND_LABELS,
  type DocumentDraft,
  COUNTS_AS_MONEY,
  HAS_DOCUMENT_NUMBER,
  ISSUED_DOCUMENT,
  NOT_ISSUED,
  NO_DOCUMENT_NUMBER,
  SESSION_HAS_DOCUMENT_NUMBER,
  UNISSUED_DOCUMENT,
  UNLINKED_SESSION,
  hasDocumentNumber,
  isIssuedDocument,
  sessionHasDocumentNumber,
  decimalToAgorot,
  olderInvoiceRefusal,
} from "@/lib/billing-docs";
import { LISTED_DOCUMENT } from "@/lib/income-doc-list";

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
    expect(creatableKinds(true).map((k) => k.code)).toEqual([320, 305, 400, 330]);
  });
  it("shows all four document squares to a VAT-liable business, in her order", () => {
    expect(docKindSquares(true).map((k) => k.code)).toEqual([305, 320, 400, 330]);
    expect(docKindSquares(false).map((k) => k.code)).toEqual([400]);
  });
  it("doesn't let the new credit-note kind change where the form starts", () => {
    expect(defaultKind(true, null)).toBe("TAX_INVOICE_RECEIPT");
    expect(defaultKind(false, null)).toBe("RECEIPT");
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
    const none = { morningDocId: null, morningDocNumber: null };
    expect(canCreditNote({ ...none, docType: 305, morningDocId: "x", status: "SENT" })).toBe(true);
    expect(canCreditNote({ ...none, docType: 320, morningDocId: "x", status: "PAID" })).toBe(true);
    // issued elsewhere, its number recorded by hand
    expect(canCreditNote({ ...none, docType: 305, morningDocNumber: "20017", status: "SENT" })).toBe(true);
    expect(canCreditNote({ ...none, docType: 320, status: "PAID" })).toBe(false);
    expect(canCreditNote({ ...none, docType: 400, morningDocId: "x", status: "PAID" })).toBe(false);
    expect(canCreditNote({ ...none, docType: 305, morningDocId: "x", status: "CANCELLED" })).toBe(false);
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

describe("issuing by hand elsewhere", () => {
  it("keeps the Israeli type codes", () => {
    expect(DOC_KINDS.RECEIPT.code).toBe(400);
    expect(DOC_KINDS.TAX_INVOICE.code).toBe(305);
    expect(DOC_KINDS.CREDIT_NOTE.code).toBe(330);
  });
  it("summarises the document to paste", () => {
    const text = documentCopyText(
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

describe("the document form's helpers", () => {
  it("finds the last day of the month, leap years included", () => {
    expect(lastDayOfMonth("2026-11-02")).toBe("2026-11-30");
    expect(lastDayOfMonth("2026-12-31")).toBe("2026-12-31");
    expect(lastDayOfMonth("2028-02-01")).toBe("2028-02-29");
    expect(lastDayOfMonth("2027-02-15")).toBe("2027-02-28");
  });
  it("keeps several addresses in one column", () => {
    expect(joinEmails(["a@x.co", " ", "b@x.co "])).toBe("a@x.co, b@x.co");
    expect(joinEmails([])).toBeNull();
    expect(splitEmails("a@x.co, b@x.co")).toEqual(["a@x.co", "b@x.co"]);
    expect(splitEmails(null)).toEqual([]);
  });
  it("names a one-off client by the printed name", () => {
    expect(documentClientName({ docClientName: "אורח", client: null })).toBe("אורח");
    expect(documentClientName({ client: { firstName: "דנה", lastName: "לוי" } })).toBe("דנה לוי");
    expect(documentClientName({ docClientName: " ", client: null })).toBe("לקוח מזדמן");
  });
  it("shows money in the document's currency", () => {
    expect(formatDocMoney(35000)).toContain("₪");
    expect(formatDocMoney(35000, "USD")).toContain("$");
    expect(formatDocMoney(-1800)).toBe("−₪18.00");
  });
  const blank = { kind: "TAX_INVOICE" as const, clientName: "", date: "2026-11-02", vatIncluded: true, items: [], payments: [] };
  it("keeps an unfinished draft, but not an empty one", () => {
    expect(draftSaveProblems(blank, true)).toHaveLength(1);
    expect(draftSaveProblems({ ...blank, clientName: "אורח" }, true)).toEqual([]);
    expect(draftSaveProblems({ ...blank, remarks: "להשלים" }, true)).toEqual([]);
  });
  it("refuses a bad address only when the document is finished", () => {
    const d = { ...blank, clientName: "אורח", clientEmails: ["not-an-address"] };
    expect(draftSaveProblems(d, true)).toEqual([]);
    expect(documentProblems(d, true).join(" ")).toContain("not-an-address");
  });
});

describe("per-document settings", () => {
  it("starts from Settings, and an exempt business has no VAT type", () => {
    expect(documentDefaults({})).toEqual({ currency: "ILS", lang: "he", vatType: 0, rounding: false });
    expect(documentDefaults({ docCurrency: "USD", docLang: "en", docVatType: 1, docRounding: true, vatLiable: true })).toEqual({
      currency: "USD",
      lang: "en",
      vatType: 1,
      rounding: true,
    });
    expect(documentDefaults({ docVatType: 1, vatLiable: false }).vatType).toBe(0);
    expect(documentDefaults({ docCurrency: "XXX" }).currency).toBe("ILS");
  });
  it("adds no VAT to a document marked exempt", () => {
    const d = {
      kind: "TAX_INVOICE" as const,
      clientName: "א",
      date: "2026-11-02",
      vatIncluded: false,
      vatType: 1,
      items: [{ description: "x", quantity: 1, unitPriceAgorot: 10000 }],
      payments: [],
    };
    const t = documentTotals(d, true);
    expect(t.vatAgorot).toBe(0);
    expect(t.totalAgorot).toBe(10000);
    expect(documentTotals({ ...d, vatType: 0 }, true).vatAgorot).toBeGreaterThan(0);
  });
  it("calls a payment app's reference an approval number", () => {
    expect(paymentDetailLabel("BIT", "reference")).toBe("מספר אישור");
    expect(paymentDetailLabel("PAYPAL", "reference")).toBe("מספר אסמכתה");
    expect(paymentDetailLabel("GOOGLE_PAY", "reference")).toBe("מספר אישור");
    expect(paymentDetailLabel("APPLE_PAY", "reference")).toBe("מספר אישור");
    expect(paymentDetailLabel("GIFT_VOUCHER", "reference")).toBe("מספר שובר");
    expect(paymentDetailLabel("OTHER", "details")).toBe("פירוט");
  });
  it("names the payment types as their apps do, every one of them", () => {
    expect(PAYMENT_KIND_LABELS.BIT).toBe("Bit");
    expect(PAYMENT_KIND_LABELS.PAYBOX).toBe("PayBox");
    expect(PAYMENT_KIND_LABELS.CHECK).toBe("המחאה (צ׳ק)");
    for (const k of PAYMENT_KINDS) {
      expect(PAYMENT_KIND_LABELS[k]).toBeTruthy();
      expect(PAYMENT_DETAIL_FIELDS[k]).toBeDefined();
    }
    // Only "אחר" asks what it was
    expect(PAYMENT_KINDS.filter((k) => PAYMENT_DETAIL_FIELDS[k].includes("details"))).toEqual(["OTHER"]);
  });
  it("copies an \"אחר\" payment with what it was", () => {
    const text = documentCopyText(
      {
        ...base,
        kind: "RECEIPT",
        payments: [{ method: "OTHER", date: "2026-10-14", amountAgorot: 45000, details: "שובר של הוועד" }],
      },
      false,
    );
    expect(text).toContain("• אחר ₪450.00 (2026-10-14) — פירוט: שובר של הוועד");
  });
});

describe("when a document counts as money", () => {
  it("is once morning issued it, or she typed its number", () => {
    const d = { docType: 305, morningDocId: null, morningDocNumber: null };
    expect(isUnissuedDocument(d)).toBe(true);
    expect(isUnissuedDocument({ ...d, morningDocId: "x" })).toBe(false);
    expect(isUnissuedDocument({ ...d, morningDocNumber: "20500" })).toBe(false);
  });
  it("leaves older app invoices alone", () => {
    expect(isUnissuedDocument({ docType: null, morningDocId: null, morningDocNumber: null })).toBe(false);
  });
});

// ── PR 1.1: one "issued" predicate ─────────────────────────────────────────

/** Enough of Prisma's where semantics to run the fragments against plain rows. */
type Where = Record<string, unknown>;
function matches(where: Where, row: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Where[]).some((w) => matches(w, row));
    if (key === "AND") return (cond as Where[]).every((w) => matches(w, row));
    const v = row[key];
    if (cond === null) return v === null;
    if (typeof cond === "object" && cond && "not" in cond) {
      const not = (cond as { not: unknown }).not;
      return not === null ? v !== null : v !== not;
    }
    return v === cond;
  });
}

describe("the issued predicate, for each kind of document", () => {
  const none = { morningDocId: null, morningDocNumber: null };
  // Every kind a row can be today
  const kinds = {
    olderInvoice: { docType: null, ...none, status: "SENT" },
    olderInvoiceWithMorningReceipt: { docType: null, morningDocId: "gi-1", morningDocNumber: null, status: "PAID" },
    legacyMorningIssued: { docType: 305, morningDocId: "gi-2", morningDocNumber: "1001", status: "SENT" },
    legacyMorningIdOnly: { docType: 320, morningDocId: "gi-3", morningDocNumber: null, status: "PAID" },
    typedNumber: { docType: 320, morningDocId: null, morningDocNumber: "20500", status: "PAID" },
    draft: { docType: 305, ...none, status: "DRAFT" },
    cancelledDraft: { docType: 400, ...none, status: "CANCELLED" },
    cancelledIssued: { docType: 305, morningDocId: null, morningDocNumber: "20017", status: "CANCELLED" },
    creditNoteDraft: { docType: 330, ...none, status: "DRAFT" },
    creditNoteIssued: { docType: 330, morningDocId: null, morningDocNumber: "30001", status: "SENT" },
  } as const;
  type Kind = keyof typeof kinds;

  const expected: Record<Kind, { issued: boolean; counts: boolean; numbered: boolean; credit: boolean; listed: boolean }> = {
    olderInvoice: { issued: false, counts: true, numbered: false, credit: false, listed: true },
    olderInvoiceWithMorningReceipt: { issued: true, counts: true, numbered: false, credit: false, listed: true },
    legacyMorningIssued: { issued: true, counts: true, numbered: true, credit: true, listed: true },
    legacyMorningIdOnly: { issued: true, counts: true, numbered: false, credit: true, listed: false },
    typedNumber: { issued: true, counts: true, numbered: true, credit: true, listed: true },
    draft: { issued: false, counts: false, numbered: false, credit: false, listed: false },
    cancelledDraft: { issued: false, counts: false, numbered: false, credit: false, listed: false },
    cancelledIssued: { issued: true, counts: true, numbered: true, credit: false, listed: true },
    creditNoteDraft: { issued: false, counts: false, numbered: false, credit: false, listed: false },
    creditNoteIssued: { issued: true, counts: true, numbered: true, credit: false, listed: true },
  };

  it.each(Object.keys(kinds) as Kind[])("%s", (k) => {
    const row = kinds[k];
    const e = expected[k];
    expect(isIssuedDocument(row)).toBe(e.issued);
    expect(isUnissuedDocument(row)).toBe(!e.counts);
    expect(hasDocumentNumber(row)).toBe(e.numbered);
    expect(canCreditNote(row)).toBe(e.credit);
    // The query forms agree with the in-memory ones on every kind
    expect(matches(ISSUED_DOCUMENT, row)).toBe(e.issued);
    expect(matches(NOT_ISSUED, row)).toBe(!e.issued);
    expect(matches(COUNTS_AS_MONEY, row)).toBe(e.counts);
    expect(matches(UNISSUED_DOCUMENT, row)).toBe(!e.counts);
    expect(matches(HAS_DOCUMENT_NUMBER, row)).toBe(e.numbered);
    expect(matches(NO_DOCUMENT_NUMBER, row)).toBe(!e.numbered);
    expect(matches(LISTED_DOCUMENT, row)).toBe(e.listed);
  });

  it("builds exactly the queries the 19 hand-written checks did", () => {
    expect(COUNTS_AS_MONEY).toEqual({
      OR: [{ docType: null }, { morningDocId: { not: null } }, { morningDocNumber: { not: null } }],
    });
    expect(UNISSUED_DOCUMENT).toEqual({ docType: { not: null }, morningDocId: null, morningDocNumber: null });
    expect(ISSUED_DOCUMENT).toEqual({ OR: [{ morningDocId: { not: null } }, { morningDocNumber: { not: null } }] });
    expect(NOT_ISSUED).toEqual({ morningDocId: null, morningDocNumber: null });
    expect(LISTED_DOCUMENT).toEqual({ OR: [{ docType: null }, { morningDocNumber: { not: null } }] });
    expect(NO_DOCUMENT_NUMBER).toEqual({ morningDocNumber: null });
  });
});

describe("a meeting's document numbers", () => {
  const empty = { morningDocNumber: null, morningReceiptNumber: null, morningInvoiceReceiptNumber: null };
  it.each([
    ["none", empty, false],
    ["חשבונית מס", { ...empty, morningDocNumber: "1" }, true],
    ["קבלה", { ...empty, morningReceiptNumber: "2" }, true],
    ["חשבונית מס/קבלה", { ...empty, morningInvoiceReceiptNumber: "3" }, true],
  ] as const)("%s", (_name, s, has) => {
    expect(sessionHasDocumentNumber(s)).toBe(has);
    expect(matches(SESSION_HAS_DOCUMENT_NUMBER, s)).toBe(has);
    // "מסמך חדש" suggests a meeting only without a number (and without a document)
    expect(matches(UNLINKED_SESSION, { ...s, invoiceItem: null })).toBe(!has);
  });
});

// ── PR 1.2: payments only on open older invoices, in agorot ────────────────

describe("which rows the older-invoice actions may change", () => {
  const none = { morningDocId: null, morningDocNumber: null };
  it("an older invoice nothing was issued for", () => {
    expect(olderInvoiceRefusal({ docType: null, ...none })).toBeNull();
  });
  it.each([
    ["morning-issued", { docType: 305, morningDocId: "gi-1", morningDocNumber: "1001" }],
    ["typed number", { docType: 320, morningDocId: null, morningDocNumber: "20500" }],
    ["issued credit note", { docType: 330, morningDocId: null, morningDocNumber: "30001" }],
    ["older invoice with a morning receipt", { docType: null, morningDocId: "gi-2", morningDocNumber: null }],
  ] as const)("refuses an issued row: %s", (_n, doc) => {
    expect(olderInvoiceRefusal(doc)).toContain("כבר הופק");
  });
  it.each([305, 320, 400, 330])("refuses a draft of type %s (its receipt lines live in the draft)", (docType) => {
    expect(olderInvoiceRefusal({ docType, ...none })).toContain("בעריכת הטיוטה");
  });
});

describe("decimalToAgorot", () => {
  it("reads stored amounts exactly", () => {
    expect(decimalToAgorot("0.1") + decimalToAgorot("0.2")).toBe(30);
    expect(decimalToAgorot("0.30")).toBe(30);
    expect(decimalToAgorot("1500")).toBe(150000);
    expect(decimalToAgorot(12.5)).toBe(1250);
    expect(decimalToAgorot("-40.05")).toBe(-4005);
    expect(decimalToAgorot({ toString: () => "99.99" })).toBe(9999);
    expect(decimalToAgorot(null)).toBe(0);
  });
  it("never rounds a value that isn't whole agorot", () => {
    expect(() => decimalToAgorot("0.005")).toThrow();
    expect(() => decimalToAgorot("abc")).toThrow();
  });
});
