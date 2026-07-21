import { describe, expect, it } from "vitest";
import { VAT_RATE, vatBreakdown } from "@/lib/vat";

describe("vatBreakdown", () => {
  it("carves 18% VAT out of an inclusive total", () => {
    expect(VAT_RATE).toBe(0.18);
    const { net, vat } = vatBreakdown(500);
    expect(net).toBe(423.73);
    expect(vat).toBe(76.27);
    expect(Math.round((net + vat) * 100) / 100).toBe(500);
  });

  it("handles zero", () => {
    expect(vatBreakdown(0)).toEqual({ net: 0, vat: 0 });
  });
});
