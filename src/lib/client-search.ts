// The search box on the clients page: does what was typed find this person?
// Pure and client-safe (no imports) — it runs in the browser over the list the
// page already holds, so what is typed never leaves the device.

/** Hebrew final letters and their regular forms: "כהן" is found by "כהנ". */
const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * Text as the search compares it: lower-case, no niqqud or accents, final
 * letters folded, quote marks dropped ("ג׳ורג׳" = "גורג"), and hyphens and any
 * other punctuation turned into single spaces ("בן-דוד" = "בן דוד").
 */
export function searchKey(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Hebrew points and cantillation, Latin combining accents
      .replace(/[\u0591-\u05C7\u0300-\u036F]/g, "")
      .toLowerCase()
      .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
      .replace(/['"`׳״’‘“”]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

/** The words typed, ready to compare. Empty when nothing (or only spaces) was typed. */
export function searchWords(query: string): string[] {
  const key = searchKey(query);
  return key ? key.split(" ") : [];
}

export type Searchable = {
  /** The whole name, in any order of its parts */
  name: string;
  phone?: string | null;
};

/** A phone's digits, in the forms someone might type: as stored, and 972… as 0… */
function phoneForms(phone: string | null | undefined): string[] {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return [];
  return digits.startsWith("972") ? [digits, `0${digits.slice(3)}`] : [digits];
}

/**
 * Every word typed must appear somewhere in the name — any part of it, in any
 * order ("לוי דנ" finds "דנה לוי"). Digits may also match the phone number,
 * and a number typed in pieces ("054-123") matches as one run of digits.
 * No words at all matches everyone.
 */
export function matchesSearch(words: string[], person: Searchable): boolean {
  if (words.length === 0) return true;
  const name = searchKey(person.name);
  if (words.every((w) => name.includes(w))) return true;

  const phones = phoneForms(person.phone);
  if (phones.length === 0) return false;
  const numeric = (w: string) => /^\d+$/.test(w);
  const typedDigits = words.filter(numeric).join("");
  if (!typedDigits || !phones.some((p) => p.includes(typedDigits))) return false;
  // A name and a number together: the rest must still be in the name
  return words.filter((w) => !numeric(w)).every((w) => name.includes(w));
}

/** Was a number typed rather than a name? (Only decides the wording of "nothing found".) */
export function isNumberSearch(query: string): boolean {
  const words = searchWords(query);
  return words.length > 0 && words.every((w) => /^\d+$/.test(w));
}
