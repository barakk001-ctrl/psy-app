import { describe, expect, it } from "vitest";
import { fallbackRateText, newSessionRate } from "@/lib/session-rate";

describe("the price of a new meeting", () => {
  it("what was typed wins", () => {
    expect(newSessionRate(300, "400", "350")).toBe(300);
    expect(newSessionRate(0, "400", "350")).toBe(0);
  });
  it("else the client's own rate", () => {
    expect(newSessionRate(undefined, "400", "350")).toBe(400);
    expect(newSessionRate(null, 420.5, null)).toBe(420.5);
  });
  it("else the practice's usual rate", () => {
    expect(newSessionRate(undefined, null, "350")).toBe(350);
    expect(newSessionRate(undefined, "", "350.50")).toBe(350.5);
  });
  it("a client seen at no charge stays at no charge", () => {
    expect(newSessionRate(undefined, "0", "350")).toBe(0);
    expect(newSessionRate(undefined, 0, 350)).toBe(0);
  });
  it("no price anywhere is no price", () => {
    expect(newSessionRate(undefined, null, null)).toBeNull();
    expect(newSessionRate(undefined, undefined, "")).toBeNull();
  });
  it("ignores what is not a price", () => {
    expect(newSessionRate(Number.NaN, "abc", "350")).toBe(350);
    expect(newSessionRate(-5, "-1", null)).toBeNull();
  });
});

describe("what the empty price field says", () => {
  it("shows the rate the meeting will be saved with", () => {
    expect(fallbackRateText("400", "350")).toBe("400");
    expect(fallbackRateText(null, "350")).toBe("350");
    expect(fallbackRateText("0", "350")).toBe("0");
    expect(fallbackRateText(null, null)).toBe("");
    expect(fallbackRateText(undefined, undefined)).toBe("");
  });
});
