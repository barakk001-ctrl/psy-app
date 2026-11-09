import { describe, expect, it } from "vitest";
import { needsShowMore, shownCount, showMoreLabel } from "@/lib/show-more";

describe("show more", () => {
  it("shows no toggle when nothing is hidden", () => {
    expect(needsShowMore(0, 2)).toBe(false);
    expect(needsShowMore(2, 2)).toBe(false);
    expect(needsShowMore(3, 2)).toBe(true);
    expect(needsShowMore(6, 5)).toBe(true);
  });

  it("shows the first rows, then all of them", () => {
    expect(shownCount(7, 2, false)).toBe(2);
    expect(shownCount(7, 2, true)).toBe(7);
    expect(shownCount(1, 2, false)).toBe(1);
    expect(shownCount(30, 5, false)).toBe(5);
  });

  it("labels the toggle with nouns", () => {
    expect(showMoreLabel(false)).toBe("הצגת עוד");
    expect(showMoreLabel(true)).toBe("הצגת פחות");
  });
});
