import { describe, expect, it } from "vitest";
import {
  buildWhatsappReminderText,
  buildWhatsappUrl,
  normalizePhoneForWhatsapp,
} from "@/lib/whatsapp";

describe("normalizePhoneForWhatsapp", () => {
  it("converts local Israeli mobile formats", () => {
    expect(normalizePhoneForWhatsapp("0501234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("050-123-4567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("050 123 4567")).toBe("972501234567");
  });

  it("accepts international formats", () => {
    expect(normalizePhoneForWhatsapp("+972501234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("972501234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("+972 50-123-4567")).toBe("972501234567");
  });

  it("accepts landlines", () => {
    expect(normalizePhoneForWhatsapp("03-1234567")).toBe("97231234567");
  });

  it("rejects unrecognizable input", () => {
    expect(normalizePhoneForWhatsapp("")).toBeNull();
    expect(normalizePhoneForWhatsapp("abc")).toBeNull();
    expect(normalizePhoneForWhatsapp("12345")).toBeNull();
  });
});

describe("buildWhatsappUrl", () => {
  it("builds a wa.me link with encoded text", () => {
    const url = buildWhatsappUrl("0501234567", "שלום, תזכורת");
    expect(url).toContain("https://wa.me/972501234567?text=");
    expect(url).toContain(encodeURIComponent("שלום, תזכורת"));
  });

  it("returns null for a bad phone", () => {
    expect(buildWhatsappUrl("nope", "text")).toBeNull();
  });
});

describe("buildWhatsappReminderText", () => {
  it("includes name, time, and meeting link for online sessions", () => {
    const text = buildWhatsappReminderText({
      clientFirstName: "דנה",
      startsAt: new Date(Date.UTC(2026, 6, 20, 7, 0)), // 10:00 Israel (UTC+3 in July)
      location: "ONLINE",
      meetingUrl: "https://zoom.example/123",
    });
    expect(text).toContain("דנה");
    expect(text).toContain("10:00");
    expect(text).toContain("https://zoom.example/123");
  });

  it("omits the link for office sessions", () => {
    const text = buildWhatsappReminderText({
      clientFirstName: "דנה",
      startsAt: new Date(Date.UTC(2026, 6, 20, 7, 0)),
      location: "OFFICE",
      meetingUrl: null,
    });
    expect(text).toContain("בקליניקה");
    expect(text).not.toContain("קישור");
  });
});
