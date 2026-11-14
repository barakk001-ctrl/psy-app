import { describe, expect, it } from "vitest";
import { isNumberSearch, matchesSearch, searchKey, searchWords } from "@/lib/client-search";

// Invented people only
const dana = { name: "דנה לוי", phone: "054-123-4567" };
const yonatan = { name: "יונתן בן-דוד", phone: "+972 52 765 4321" };
const emma = { name: "Emma Müller", phone: null };

const finds = (query: string, person: { name: string; phone?: string | null }) =>
  matchesSearch(searchWords(query), person);

describe("matchesSearch", () => {
  it("finds a name by any part of it", () => {
    expect(finds("דנה", dana)).toBe(true);
    expect(finds("דנ", dana)).toBe(true);
    expect(finds("וי", dana)).toBe(true);
    expect(finds("נה ל", dana)).toBe(true);
  });

  it("takes the words in either order", () => {
    expect(finds("דנה לוי", dana)).toBe(true);
    expect(finds("לוי דנה", dana)).toBe(true);
    expect(finds("לו דנ", dana)).toBe(true);
  });

  it("needs every word typed to be in the name", () => {
    expect(finds("דנה כהן", dana)).toBe(false);
    expect(finds("מיכל", dana)).toBe(false);
    expect(finds("דנהה", dana)).toBe(false);
  });

  it("ignores spaces around and between the words", () => {
    expect(finds("  דנה  ", dana)).toBe(true);
    expect(finds("לוי    דנה", dana)).toBe(true);
    expect(finds("\tדנה\n", dana)).toBe(true);
  });

  it("matches everyone when nothing was typed", () => {
    expect(searchWords("")).toEqual([]);
    expect(searchWords("   ")).toEqual([]);
    expect(finds("", dana)).toBe(true);
    expect(finds("   ", emma)).toBe(true);
  });

  it("finds a Latin name whatever the case or accents", () => {
    expect(finds("emma", emma)).toBe(true);
    expect(finds("EMMA", emma)).toBe(true);
    expect(finds("muller em", emma)).toBe(true);
    expect(finds("Müller", emma)).toBe(true);
    expect(finds("emily", emma)).toBe(false);
  });

  it("treats final letters, niqqud, hyphens and quote marks as the same name", () => {
    expect(finds("יונתנ", yonatan)).toBe(true);
    expect(finds("בן דוד", yonatan)).toBe(true);
    expect(finds("בן-דוד", yonatan)).toBe(true);
    expect(finds("דוד יונתן", yonatan)).toBe(true);
    expect(finds("דָּנָה", dana)).toBe(true);
    expect(finds("גורג", { name: "ג׳ורג׳ חדד" })).toBe(true);
    expect(finds("ג'ורג'", { name: "ג׳ורג׳ חדד" })).toBe(true);
    expect(finds("שלום", { name: "שלומי שלום" })).toBe(true);
  });

  it("finds by the phone's digits, however it is written", () => {
    expect(finds("0541234567", dana)).toBe(true);
    expect(finds("054-123", dana)).toBe(true);
    expect(finds("4567", dana)).toBe(true);
    expect(finds("054 999", dana)).toBe(false);
    // stored with the country code, typed the local way
    expect(finds("052765", yonatan)).toBe(true);
    expect(finds("97252", yonatan)).toBe(true);
    // a name with part of the number
    expect(finds("דנה 4567", dana)).toBe(true);
    expect(finds("מיכל 4567", dana)).toBe(false);
    // no phone on file
    expect(finds("054", emma)).toBe(false);
  });
});

describe("searchKey", () => {
  it("is what the comparison sees", () => {
    expect(searchKey("  Ben-David  ")).toBe("ben david");
    expect(searchKey("כהן")).toBe("כהנ");
    expect(searchKey("O'Neil")).toBe("oneil");
  });
});

describe("isNumberSearch", () => {
  it("tells a number from a name", () => {
    expect(isNumberSearch("054-123")).toBe(true);
    expect(isNumberSearch("דנה")).toBe(false);
    expect(isNumberSearch("דנה 054")).toBe(false);
    expect(isNumberSearch("  ")).toBe(false);
  });
});
