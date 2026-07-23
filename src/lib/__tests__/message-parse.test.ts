import { describe, expect, it } from "vitest";
import {
  matchClient,
  normalizePhoneDigits,
  parseAppointmentMessage,
} from "@/lib/message-parse";

// Wed 2026-07-22 12:00 Israel (09:00Z)
const NOW = new Date("2026-07-22T09:00:00.000Z");

describe("parseAppointmentMessage", () => {
  it("parses weekday + clock time", () => {
    const p = parseAppointmentMessage("היי, אפשר לקבוע ליום שלישי ב-16:00?", NOW);
    // Next Tuesday after Wed 22.7 is 28.7
    expect(p.startsAt).toBe("2026-07-28T16:00");
    expect(p.dateFound).toBe(true);
    expect(p.timeFound).toBe(true);
  });

  it("parses numeric dates and assumes next year for past dates", () => {
    expect(parseAppointmentMessage("נתראה ב-15/8 בשעה 09:30", NOW).startsAt).toBe(
      "2026-08-15T09:30",
    );
    expect(parseAppointmentMessage("נקבע ל-15/3 ב-10:00", NOW).startsAt).toBe(
      "2027-03-15T10:00",
    );
    expect(parseAppointmentMessage("פגישה ב-15.8.27 ב-10:00", NOW).startsAt).toBe(
      "2027-08-15T10:00",
    );
  });

  it("parses Hebrew month names and relative days", () => {
    expect(parseAppointmentMessage("ב-3 באוגוסט בשעה 11:00", NOW).startsAt).toBe(
      "2026-08-03T11:00",
    );
    expect(parseAppointmentMessage("מחר ב-14:00", NOW).startsAt).toBe(
      "2026-07-23T14:00",
    );
    expect(parseAppointmentMessage("מחרתיים בשעה 18:00", NOW).startsAt).toBe(
      "2026-07-24T18:00",
    );
  });

  it("interprets small bare hours as afternoon", () => {
    const p = parseAppointmentMessage("אפשר מחר ב-4?", NOW);
    expect(p.startsAt).toBe("2026-07-23T16:00");
  });

  it("extracts Israeli phones in various formats", () => {
    expect(parseAppointmentMessage("הטלפון שלי 050-123-4567", NOW).phone).toBe(
      "0501234567",
    );
    expect(parseAppointmentMessage("צלצלי אליי +972 52 765 4321", NOW).phone).toBe(
      "0527654321",
    );
  });

  it("detects location hints", () => {
    expect(parseAppointmentMessage("עדיף בזום מחר ב-10:00", NOW).location).toBe(
      "ONLINE",
    );
    expect(parseAppointmentMessage("ניפגש בקליניקה מחר ב-10:00", NOW).location).toBe(
      "OFFICE",
    );
  });

  it("guesses a signature name", () => {
    const p = parseAppointmentMessage("אפשר יום חמישי ב-12:00?\nתודה,\nדנה כהן", NOW);
    expect(p.nameGuess).toBe("דנה כהן");
  });

  it("defaults time to 10:00 when only a date is found", () => {
    const p = parseAppointmentMessage("נקבע ל-20/8?", NOW);
    expect(p.startsAt).toBe("2026-08-20T10:00");
    expect(p.timeFound).toBe(false);
  });

  it("returns nulls for unparseable text", () => {
    const p = parseAppointmentMessage("שלום, מה שלומך?", NOW);
    expect(p.startsAt).toBeNull();
    expect(p.phone).toBeNull();
  });
});

describe("matchClient", () => {
  const clients = [
    { id: "1", firstName: "דנה", lastName: "כהן", phone: "0501234567" },
    { id: "2", firstName: "יוסי", lastName: "לוי", phone: "0527654321" },
    { id: "3", firstName: "דנה", lastName: "מזרחי", phone: null },
  ];

  it("matches by full name in text", () => {
    expect(matchClient(clients, "פגישה עם דנה כהן מחר", null)?.id).toBe("1");
  });

  it("matches by normalized phone", () => {
    expect(matchClient(clients, "לקבוע פגישה", "0527654321")?.id).toBe("2");
    expect(matchClient(clients, "טקסט", normalizePhoneDigits("+972501234567"))?.id).toBe(
      "1",
    );
  });

  it("skips ambiguous first-name matches", () => {
    // Two clients named דנה — no unique match
    expect(matchClient(clients, "דנה רוצה פגישה", null)).toBeNull();
  });

  it("matches unique first name", () => {
    expect(matchClient(clients, "יוסי ביקש לקבוע", null)?.id).toBe("2");
  });
});
