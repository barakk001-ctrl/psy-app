import { describe, expect, it } from "vitest";
import { buildIcs, eventTitle, icsDate, icsEscape, type IcsSession } from "@/lib/ics";

const session = (over: Partial<IcsSession> = {}): IcsSession => ({
  id: "abc123",
  startsAt: new Date("2026-09-10T06:00:00Z"),
  endsAt: new Date("2026-09-10T06:50:00Z"),
  status: "SCHEDULED",
  treatmentType: "טיפול פרטני",
  location: "OFFICE",
  clientFirstName: "דנה",
  clientLastName: "כהן",
  ...over,
});

describe("icsDate", () => {
  it("formats UTC basic format", () => {
    expect(icsDate(new Date("2026-09-10T06:05:09Z"))).toBe("20260910T060509Z");
  });
});

describe("icsEscape", () => {
  it("escapes RFC 5545 specials", () => {
    expect(icsEscape("a,b;c\nd\\e")).toBe("a\\,b\\;c\\nd\\\\e");
  });
});

describe("eventTitle", () => {
  it("uses first name by default mode", () => {
    expect(eventTitle(session(), "FIRST")).toBe("פגישה — דנה");
  });
  it("uses full name in FULL mode", () => {
    expect(eventTitle(session(), "FULL")).toBe("פגישה — דנה כהן");
  });
  it("hides the name in NONE mode", () => {
    expect(eventTitle(session(), "NONE")).toBe("פגישה");
  });
  it("marks cancelled sessions", () => {
    expect(eventTitle(session({ status: "CANCELLED" }), "NONE")).toBe("[בוטלה] פגישה");
  });
});

describe("buildIcs", () => {
  it("produces a valid VCALENDAR with CRLF endings and event fields", () => {
    const ics = buildIcs([session()], "FIRST");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:abc123@merapa-ishit");
    expect(ics).toContain("DTSTART:20260910T060000Z");
    expect(ics).toContain("DTEND:20260910T065000Z");
    expect(ics).toContain("SUMMARY:פגישה — דנה");
    expect(ics).not.toContain("STATUS:CANCELLED");
  });

  it("emits STATUS:CANCELLED for cancelled sessions", () => {
    const ics = buildIcs([session({ status: "CANCELLED" })], "FIRST");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});
