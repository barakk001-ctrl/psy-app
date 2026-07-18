import { describe, expect, it } from "vitest";
import {
  MORNING_DOC_TYPES,
  buildMorningReceiptPayload,
  morningBaseUrl,
} from "@/lib/morning";

describe("morningBaseUrl", () => {
  it("selects sandbox vs production", () => {
    expect(morningBaseUrl(true)).toContain("sandbox");
    expect(morningBaseUrl(false)).toBe("https://api.greeninvoice.co.il/api/v1");
  });
});

describe("buildMorningReceiptPayload", () => {
  const input = {
    clientName: "דנה כהן",
    clientEmail: "dana@example.com",
    clientTaxId: "123456789",
    clientAddress: null,
    clientPhone: "0501234567",
    description: "קבלה עבור חשבונית #0007",
    items: [{ description: "פגישת טיפול", quantity: 4, unitPrice: 350 }],
    payments: [
      { method: "BIT", amount: 700, paidAt: new Date(Date.UTC(2026, 6, 18, 12, 0)) },
      { method: "CASH", amount: 700, paidAt: new Date(Date.UTC(2026, 6, 18, 12, 0)) },
    ],
    remarks: null,
  };

  it("builds a receipt document in ILS/Hebrew", () => {
    const payload = buildMorningReceiptPayload(input);
    expect(payload.type).toBe(MORNING_DOC_TYPES.RECEIPT);
    expect(payload.lang).toBe("he");
    expect(payload.currency).toBe("ILS");
    expect(payload.client.name).toBe("דנה כהן");
    expect(payload.client.emails).toEqual(["dana@example.com"]);
    expect(payload.client.add).toBe(false);
  });

  it("maps items and payment methods to Morning codes", () => {
    const payload = buildMorningReceiptPayload(input);
    expect(payload.income).toHaveLength(1);
    expect(payload.income[0]).toMatchObject({ quantity: 4, price: 350 });
    expect(payload.payment[0].type).toBe(10); // BIT → payment app
    expect(payload.payment[1].type).toBe(1); // cash
    expect(payload.payment[0].date).toBe("2026-07-18");
  });

  it("supports the unified tax-invoice-receipt doc type", () => {
    const payload = buildMorningReceiptPayload({
      ...input,
      docType: MORNING_DOC_TYPES.TAX_INVOICE_RECEIPT,
    });
    expect(payload.type).toBe(320);
  });

  it("omits empty client fields", () => {
    const payload = buildMorningReceiptPayload({
      ...input,
      clientEmail: null,
      clientTaxId: "",
    });
    expect(payload.client.emails).toBeUndefined();
    expect(payload.client.taxId).toBeUndefined();
  });
});
