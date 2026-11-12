import { describe, expect, it } from "vitest";
import {
  HEBREW_DATE_ON,
  gematria,
  hebrewCellLabel,
  hebrewDateOn,
  hebrewDateStorageKey,
  hebrewDayMonthText,
  hebrewMonths,
  hebrewRangeLabel,
  hebrewYearText,
  isHebrewLeapYear,
  toHebrewDate,
  type CivilDay,
} from "@/lib/hebrew-date";

const civil = (year: number, month: number, day: number): CivilDay => ({ year, month, day });
const text = (year: number, month: number, day: number) => {
  const h = toHebrewDate(civil(year, month, day));
  return `${hebrewDayMonthText(h)} ${hebrewYearText(h.year)}`;
};

describe("toHebrewDate", () => {
  it("knows well-known dates", () => {
    expect(text(1948, 5, 14)).toBe("ה׳ באייר תש״ח");
    expect(text(2000, 1, 1)).toBe("כ״ג בטבת תש״ס");
    expect(text(2024, 10, 3)).toBe("א׳ בתשרי תשפ״ה"); // Rosh Hashana 5785
    expect(text(2025, 10, 2)).toBe("י׳ בתשרי תשפ״ו"); // Yom Kippur 5786
    expect(text(2026, 3, 3)).toBe("י״ד באדר תשפ״ו"); // Purim, an ordinary year
    expect(text(2027, 4, 22)).toBe("ט״ו בניסן תשפ״ז"); // Pesach
  });

  it("turns the year over on 1 Tishrei", () => {
    expect(text(2026, 9, 11)).toBe("כ״ט באלול תשפ״ו");
    expect(text(2026, 9, 12)).toBe("א׳ בתשרי תשפ״ז");
  });

  it("crosses a month boundary, with a 30-day Cheshvan", () => {
    expect(text(2026, 11, 9)).toBe("כ״ט בחשוון תשפ״ז");
    expect(text(2026, 11, 10)).toBe("ל׳ בחשוון תשפ״ז");
    expect(text(2026, 11, 11)).toBe("א׳ בכסלו תשפ״ז");
    expect(text(2026, 11, 12)).toBe("ב׳ בכסלו תשפ״ז");
    // 5786 has a 29-day Cheshvan
    expect(text(2025, 11, 20)).toBe("כ״ט בחשוון תשפ״ו");
    expect(text(2025, 11, 21)).toBe("א׳ בכסלו תשפ״ו");
  });

  it("has two Adars in a leap year and one otherwise", () => {
    expect(isHebrewLeapYear(5787)).toBe(true);
    expect(isHebrewLeapYear(5786)).toBe(false);
    expect(text(2027, 2, 7)).toBe("ל׳ בשבט תשפ״ז");
    expect(text(2027, 2, 8)).toBe("א׳ באדר א׳ תשפ״ז");
    expect(text(2027, 3, 9)).toBe("ל׳ באדר א׳ תשפ״ז");
    expect(text(2027, 3, 10)).toBe("א׳ באדר ב׳ תשפ״ז");
    expect(text(2027, 3, 23)).toBe("י״ד באדר ב׳ תשפ״ז"); // Purim in a leap year
    expect(text(2027, 4, 8)).toBe("א׳ בניסן תשפ״ז");
    expect(hebrewMonths(5787).map((m) => m.month)).toContain("adar1");
    expect(hebrewMonths(5786).map((m) => m.month)).toContain("adar");
    expect(hebrewMonths(5786)).toHaveLength(12);
    expect(hebrewMonths(5787)).toHaveLength(13);
  });

  it("gives every year a legal length", () => {
    for (let y = 5700; y < 5900; y++) {
      const days = hebrewMonths(y).reduce((n, m) => n + m.days, 0);
      expect(isHebrewLeapYear(y) ? [383, 384, 385] : [353, 354, 355]).toContain(days);
    }
  });

  it("agrees with the platform's Hebrew calendar, day by day", () => {
    const fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    // A runtime without the Hebrew calendar has nothing to compare with
    if (fmt.resolvedOptions().calendar !== "hebrew") return;
    const wrong: string[] = [];
    for (let t = Date.UTC(2015, 0, 1); t < Date.UTC(2045, 0, 1); t += 24 * 60 * 60 * 1000) {
      const d = new Date(t);
      const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
      const h = toHebrewDate(civil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
      if (String(h.day) !== parts.day || String(h.year) !== parts.year) wrong.push(d.toISOString().slice(0, 10));
    }
    expect(wrong).toEqual([]);
  });
});

describe("gematria", () => {
  it("writes days in letters", () => {
    expect(gematria(1)).toBe("א׳");
    expect(gematria(9)).toBe("ט׳");
    expect(gematria(10)).toBe("י׳");
    expect(gematria(11)).toBe("י״א");
    expect(gematria(15)).toBe("ט״ו");
    expect(gematria(16)).toBe("ט״ז");
    expect(gematria(20)).toBe("כ׳");
    expect(gematria(29)).toBe("כ״ט");
    expect(gematria(30)).toBe("ל׳");
  });

  it("writes years in letters, without the thousands", () => {
    expect(hebrewYearText(5787)).toBe("תשפ״ז");
    expect(hebrewYearText(5786)).toBe("תשפ״ו");
    expect(hebrewYearText(5760)).toBe("תש״ס");
    expect(hebrewYearText(5700)).toBe("ת״ש");
    expect(hebrewYearText(5800)).toBe("ת״ת");
    expect(hebrewYearText(5815)).toBe("תתט״ו");
  });

  it("never prints a digit for a day or a year", () => {
    for (let d = 1; d <= 30; d++) expect(gematria(d)).not.toMatch(/[0-9]/);
    for (let y = 5780; y < 5900; y++) expect(hebrewYearText(y)).not.toMatch(/[0-9]/);
  });
});

describe("hebrewCellLabel", () => {
  const firstOnScreen = civil(2026, 11, 1);

  it("shows the day alone, and names the month on its first day and on the first day on screen", () => {
    expect(hebrewCellLabel(civil(2026, 11, 9), firstOnScreen)).toBe("כ״ט");
    expect(hebrewCellLabel(civil(2026, 11, 11), firstOnScreen)).toBe("א׳ בכסלו");
    expect(hebrewCellLabel(civil(2026, 11, 1), firstOnScreen)).toBe("כ״א בחשוון");
    expect(hebrewCellLabel(civil(2026, 11, 2), firstOnScreen)).toBe("כ״ב");
    expect(hebrewCellLabel(civil(2026, 11, 9), null)).toBe("כ״ט");
  });

  it("names the month on every day when asked", () => {
    expect(hebrewCellLabel(civil(2026, 11, 9), null, true)).toBe("כ״ט בחשוון");
  });
});

describe("hebrewRangeLabel", () => {
  it("names the months a span covers", () => {
    // November 2026
    expect(hebrewRangeLabel(civil(2026, 11, 1), civil(2026, 11, 30))).toBe("חשוון–כסלו תשפ״ז");
    // one day, one week inside a month
    expect(hebrewRangeLabel(civil(2026, 11, 12), civil(2026, 11, 12))).toBe("כסלו תשפ״ז");
    expect(hebrewRangeLabel(civil(2026, 11, 15), civil(2026, 11, 21))).toBe("כסלו תשפ״ז");
    // September 2026 holds the new year
    expect(hebrewRangeLabel(civil(2026, 9, 1), civil(2026, 9, 30))).toBe("אלול תשפ״ו – תשרי תשפ״ז");
    // March 2027, a leap year
    expect(hebrewRangeLabel(civil(2027, 3, 1), civil(2027, 3, 31))).toBe("אדר א׳–אדר ב׳ תשפ״ז");
  });
});

describe("the checkbox's memory", () => {
  it("keeps each account's choice under its own key", () => {
    expect(hebrewDateStorageKey("user-a")).toBe("calendar.hebrewDate.user-a");
    expect(hebrewDateStorageKey("user-a")).not.toBe(hebrewDateStorageKey("user-b"));
  });

  it("is off unless it was ticked", () => {
    expect(hebrewDateOn(HEBREW_DATE_ON)).toBe(true);
    expect(hebrewDateOn(null)).toBe(false);
    expect(hebrewDateOn(undefined)).toBe(false);
    expect(hebrewDateOn("")).toBe(false);
    expect(hebrewDateOn("0")).toBe(false);
  });
});
