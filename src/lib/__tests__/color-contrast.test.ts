import { describe, expect, it } from "vitest";
import { contrastRatio, darkenForText } from "@/lib/color-contrast";
import { MEETING_TYPE_COLORS } from "@/lib/meeting-type-colors";

const LIGHT_TEXT = "#FDFBF7";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#5C7559", "#5C7559")).toBe(1);
  });

  it("ignores the order, and an invalid colour gives 0", () => {
    expect(contrastRatio("#FFFFFF", "#123456")).toBe(contrastRatio("#123456", "#FFFFFF"));
    expect(contrastRatio("nope", "#FFFFFF")).toBe(0);
  });
});

describe("darkenForText", () => {
  it("leaves a colour that already passes alone", () => {
    expect(darkenForText("#5C7559", LIGHT_TEXT)).toBe("#5C7559");
  });

  it("every colour on offer ends up readable under the pill text", () => {
    for (const c of MEETING_TYPE_COLORS) {
      expect(contrastRatio(darkenForText(c, LIGHT_TEXT), LIGHT_TEXT)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("a very light colour is darkened as far as it takes", () => {
    expect(contrastRatio(darkenForText("#F2EDE2", LIGHT_TEXT), LIGHT_TEXT)).toBeGreaterThanOrEqual(4.5);
  });

  it("returns something that isn't a colour unchanged", () => {
    expect(darkenForText("var(--x)", LIGHT_TEXT)).toBe("var(--x)");
  });
});
