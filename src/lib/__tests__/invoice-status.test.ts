import { describe, expect, it } from "vitest";
import { computeInvoiceStatus } from "@/lib/invoice-status";

describe("computeInvoiceStatus", () => {
  it("keeps cancelled invoices cancelled regardless of payments", () => {
    expect(computeInvoiceStatus("CANCELLED", 0, 100)).toBe("CANCELLED");
    expect(computeInvoiceStatus("CANCELLED", 100, 100)).toBe("CANCELLED");
  });

  it("marks fully paid invoices PAID", () => {
    expect(computeInvoiceStatus("SENT", 100, 100)).toBe("PAID");
    expect(computeInvoiceStatus("DRAFT", 150, 100)).toBe("PAID");
  });

  it("marks partially paid invoices PARTIALLY_PAID", () => {
    expect(computeInvoiceStatus("SENT", 50, 100)).toBe("PARTIALLY_PAID");
    expect(computeInvoiceStatus("DRAFT", 1, 100)).toBe("PARTIALLY_PAID");
  });

  it("falls back to DRAFT or SENT when nothing is paid", () => {
    expect(computeInvoiceStatus("DRAFT", 0, 100)).toBe("DRAFT");
    expect(computeInvoiceStatus("SENT", 0, 100)).toBe("SENT");
    expect(computeInvoiceStatus("PAID", 0, 100)).toBe("SENT");
    expect(computeInvoiceStatus("PARTIALLY_PAID", 0, 100)).toBe("SENT");
  });

  it("does not mark a zero-total invoice PAID", () => {
    expect(computeInvoiceStatus("DRAFT", 0, 0)).toBe("DRAFT");
  });
});
