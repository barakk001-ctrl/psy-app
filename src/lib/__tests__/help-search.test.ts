import { describe, expect, it } from "vitest";
import { normalizeHebrew, searchHelp, wordVariants, type HelpArticle } from "../help-search";
import { HELP_ARTICLES, POPULAR_HELP_SLUGS, helpArticleBySlug } from "../help-articles";

const art = (slug: string, title: string, body = "", keywords: string[] = []): HelpArticle => ({
  slug,
  title,
  category: "כללי",
  summary: "",
  keywords,
  body: body ? [{ type: "p", text: body }] : [],
});

const sample = [
  art("invoice", "הפקת חשבונית", "בוחרים לקוח ופגישות לחיוב"),
  art("meeting", "קביעת פגישה", "פגישה קבועה כל שבוע", ["יומן"]),
  art("summary", "סיכום פגישה", "כותבים ושומרים את הסיכום"),
  art("morning", "חיבור ל-morning", "מפתחות API"),
];
const slugs = (q: string, list = sample) => searchHelp(q, list).map((a) => a.slug);

describe("normalizeHebrew", () => {
  it("drops niqqud, quote marks and final letters", () => {
    expect(normalizeHebrew("שָׁלוֹם")).toBe("שלומ");
    expect(normalizeHebrew("מע״מ")).toBe(normalizeHebrew("מעמ"));
    expect(normalizeHebrew('דו"ח')).toBe("דוח");
    expect(normalizeHebrew("Morning  API")).toBe("morning api");
  });
});

describe("wordVariants", () => {
  it("strips leading prefix letters but keeps at least three letters", () => {
    expect(wordVariants("בחשבונית")).toContain("חשבונית");
    expect(wordVariants("והפגישה")).toContain("פגישה");
    expect(wordVariants("מה")).toEqual(["מה"]);
  });
  it("strips plural endings (on normalized words)", () => {
    expect(wordVariants(normalizeHebrew("מטופלים"))).toContain("מטופל");
    expect(wordVariants("פגישות")).toContain("פגיש");
    expect(wordVariants("חשבוניות")).toContain("חשבוני");
  });
  it("leaves latin words alone", () => {
    expect(wordVariants("morning")).toEqual(["morning"]);
  });
});

describe("searchHelp", () => {
  it("returns nothing for an empty query", () => {
    expect(slugs("   ")).toEqual([]);
  });
  it("matches titles and bodies", () => {
    expect(slugs("חשבונית")).toEqual(["invoice"]);
    expect(slugs("מפתחות")).toEqual(["morning"]);
  });
  it("is Hebrew-friendly: prefixes, plurals, final letters", () => {
    expect(slugs("בחשבונית")).toEqual(["invoice"]);
    expect(slugs("חשבוניות")).toEqual(["invoice"]);
    expect(slugs("פגישות")).toContain("meeting");
    expect(slugs("סיכומים")).toContain("summary");
  });
  it("requires every word to match", () => {
    expect(slugs("סיכום פגישה")).toEqual(["summary"]);
    expect(slugs("סיכום חשבונית")).toEqual([]);
  });
  it("ranks a title match above a body match", () => {
    expect(slugs("פגישה")[0]).toBe("meeting");
  });
  it("is case-insensitive for latin text", () => {
    expect(slugs("MORNING")).toEqual(["morning"]);
  });
});

describe("help articles", () => {
  it("has 8–12 articles with unique slugs and content", () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(8);
    expect(HELP_ARTICLES.length).toBeLessThanOrEqual(12);
    expect(new Set(HELP_ARTICLES.map((a) => a.slug)).size).toBe(HELP_ARTICLES.length);
    for (const a of HELP_ARTICLES) {
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.body.length).toBeGreaterThan(0);
    }
  });
  it("lists only existing articles as popular", () => {
    for (const slug of POPULAR_HELP_SLUGS) expect(helpArticleBySlug(slug)).toBeDefined();
  });
  it("links only inside the app", () => {
    for (const a of HELP_ARTICLES) {
      for (const b of a.body) if (b.type === "link") expect(b.href.startsWith("/")).toBe(true);
    }
  });
  it("doesn't flood results with loose stem matches", () => {
    const find = (q: string) => searchHelp(q, HELP_ARTICLES).map((a) => a.slug);
    expect(find("בקבלות")[0]).toBe("invoices-receipts");
    expect(find("בקבלות").length).toBeLessThanOrEqual(3);
  });
  it("finds the real articles for common searches", () => {
    const find = (q: string) => searchHelp(q, HELP_ARTICLES).map((a) => a.slug);
    expect(find("קבלה")).toContain("invoices-receipts");
    expect(find("פגישה קבועה")[0]).toBe("schedule-meeting");
    expect(find("סיכום")[0]).toBe("session-summary");
    expect(find("ניתוק אוטומטי")).toContain("login-security");
    expect(find("פייס איידי")).toContain("login-security");
    expect(find("מורנינג")).toContain("connect-morning");
    expect(find("דוח חודשי")).toContain("reports");
  });
});
