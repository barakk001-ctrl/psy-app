import { describe, expect, it } from "vitest";
import {
  clinicDaysBetween,
  splitFullName,
  telHref,
  waitingText,
  whatsappChatHref,
} from "@/lib/waitlist";

describe("splitFullName", () => {
  it("takes the first word as the first name", () => {
    expect(splitFullName("יעל כהן")).toEqual({ firstName: "יעל", lastName: "כהן" });
    expect(splitFullName("  יעל   כהן  לוי ")).toEqual({ firstName: "יעל", lastName: "כהן לוי" });
  });
  it("handles a single word and empty input", () => {
    expect(splitFullName("דנה")).toEqual({ firstName: "דנה", lastName: "" });
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("telHref", () => {
  it("dials Israeli numbers in international form", () => {
    expect(telHref("050-123-4567")).toBe("tel:+972501234567");
    expect(telHref("+972 50 123 4567")).toBe("tel:+972501234567");
  });
  it("keeps other numbers as typed digits", () => {
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
    expect(telHref("*2700")).toBe("tel:2700");
  });
  it("returns null with nothing to dial", () => {
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref("ab")).toBeNull();
  });
});

describe("whatsappChatHref", () => {
  it("links Israeli numbers only", () => {
    expect(whatsappChatHref("0501234567")).toBe("https://wa.me/972501234567");
    expect(whatsappChatHref("12")).toBeNull();
    expect(whatsappChatHref(undefined)).toBeNull();
  });
});

describe("waiting time", () => {
  it("counts clinic calendar days, not 24-hour spans", () => {
    // 23:30 and 00:30 Israel time (UTC+3 in summer) are different days
    const late = new Date("2026-10-13T20:30:00Z");
    const early = new Date("2026-10-13T21:30:00Z");
    expect(clinicDaysBetween(late, early)).toBe(1);
    expect(clinicDaysBetween(early, late)).toBe(0);
  });
  it("words the wait", () => {
    const now = new Date("2026-10-14T09:00:00Z");
    expect(waitingText(new Date("2026-10-14T06:00:00Z"), now)).toBeNull();
    expect(waitingText(new Date("2026-10-13T06:00:00Z"), now)).toBe("ממתין/ה יום אחד");
    expect(waitingText(new Date("2026-10-02T06:00:00Z"), now)).toBe("ממתין/ה 12 ימים");
  });
});
