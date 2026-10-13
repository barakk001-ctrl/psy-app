import { describe, expect, it } from "vitest";
import { formatCurrency } from "../format";
import { desktopFitDivisor, estimateTextEm, fitCqi, splitZeroDecimals } from "../stat-value";

describe("splitZeroDecimals", () => {
  it("splits a whole-shekel amount into whole part, .00 and the currency", () => {
    const text = formatCurrency(22900);
    const split = splitZeroDecimals(text);
    expect(split).not.toBeNull();
    expect(split!.decimals).toBe(".00");
    expect(split!.whole + split!.decimals + split!.suffix).toBe(text);
    expect(split!.whole).toContain("22,900");
    expect(split!.suffix).toContain("₪");
  });

  it("handles six-digit amounts", () => {
    const split = splitZeroDecimals(formatCurrency(123450));
    expect(split!.whole).toContain("123,450");
  });

  it("keeps real agorot", () => {
    expect(splitZeroDecimals(formatCurrency(120.5))).toBeNull();
    expect(splitZeroDecimals(formatCurrency(99.99))).toBeNull();
  });

  it("leaves plain counts alone", () => {
    expect(splitZeroDecimals("4")).toBeNull();
    expect(splitZeroDecimals("100")).toBeNull();
    expect(splitZeroDecimals("—")).toBeNull();
  });
});

describe("fitCqi", () => {
  it("ignores the zero-width bidi marks", () => {
    expect(estimateTextEm("\u200f12\u200f")).toBe(estimateTextEm("12"));
  });

  it("gives longer amounts a smaller size", () => {
    expect(fitCqi(formatCurrency(123450))).toBeLessThan(fitCqi(formatCurrency(22900)));
    expect(fitCqi(formatCurrency(22900))).toBeLessThan(fitCqi("4"));
  });

  it("fits a six-digit amount with agorot into the card width", () => {
    // size in cqi × width in em must stay under 100% of the card
    const text = formatCurrency(123450.5);
    expect(fitCqi(text) * estimateTextEm(text)).toBeLessThan(100);
  });
});

describe("desktopFitDivisor", () => {
  it("is a little more than the estimated width, so fitting values keep 30px", () => {
    const text = formatCurrency(22900);
    expect(desktopFitDivisor(text)).toBeGreaterThan(estimateTextEm(text));
    expect(desktopFitDivisor(text)).toBeLessThan(estimateTextEm(text) * 1.02);
  });

  it("grows with the amount", () => {
    expect(desktopFitDivisor(formatCurrency(123450))).toBeGreaterThan(
      desktopFitDivisor(formatCurrency(22900)),
    );
  });

  it("never divides by zero", () => {
    expect(desktopFitDivisor("")).toBeGreaterThan(0);
  });
});
