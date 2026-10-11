import { describe, expect, it } from "vitest";
import { copyrightYears } from "../copyright";

describe("copyrightYears", () => {
  it("is just the first year during 2026", () => {
    expect(copyrightYears(new Date("2026-10-11T09:00:00Z"))).toBe("2026");
  });

  it("becomes a range from the next year on", () => {
    expect(copyrightYears(new Date("2027-03-01T09:00:00Z"))).toBe("2026–2027");
    expect(copyrightYears(new Date("2031-06-15T09:00:00Z"))).toBe("2026–2031");
  });

  it("follows the clinic calendar, not the UTC server clock", () => {
    // 23:30 UTC on 31 Dec 2026 is already 1 Jan 2027 in Jerusalem
    expect(copyrightYears(new Date("2026-12-31T23:30:00Z"))).toBe("2026–2027");
  });

  it("never goes below the first year", () => {
    expect(copyrightYears(new Date("2025-05-01T09:00:00Z"))).toBe("2026");
  });
});
