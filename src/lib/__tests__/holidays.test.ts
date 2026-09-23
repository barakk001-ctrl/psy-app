import { describe, expect, it } from "vitest";
import { parseHebcal } from "../holidays";

const item = (date: string, hebrew: string, category = "holiday") => ({
  date,
  category,
  hebrew,
  title: hebrew,
});

describe("parseHebcal", () => {
  it("maps holidays to their day, without the year number", () => {
    const got = parseHebcal({
      items: [
        item("2026-09-11", "ערב ראש השנה"),
        item("2026-09-12", "ראש השנה 5787"),
        item("2026-09-21", "יום כיפור"),
      ],
    });
    expect(got).toEqual({
      "2026-09-11": ["ערב ראש השנה"],
      "2026-09-12": ["ראש השנה"],
      "2026-09-21": ["יום כיפור"],
    });
  });

  it("drops entries that are noise in a clinic calendar", () => {
    const got = parseHebcal({
      items: [
        item("2026-09-05", "סליחות"),
        item("2026-10-18", "שמירת בית הספר ליום העליה"),
        item("2026-09-05", "פרשת כי תבוא", "parashat"),
      ],
    });
    expect(got).toEqual({});
  });

  it("keeps two holidays on one day, once each", () => {
    const got = parseHebcal({
      items: [item("2026-12-05", "חנוכה: א׳ נר"), item("2026-12-05", "חנוכה: א׳ נר"), item("2026-12-05", "ראש חודש")],
    });
    expect(got["2026-12-05"]).toEqual(["חנוכה: א׳ נר", "ראש חודש"]);
  });

  it("returns nothing for a malformed response", () => {
    expect(parseHebcal(null)).toEqual({});
    expect(parseHebcal({ items: "x" })).toEqual({});
  });
});
