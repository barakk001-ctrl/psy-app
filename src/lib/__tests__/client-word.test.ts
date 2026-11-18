import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AS_WRITTEN,
  CLIENT_WORDS,
  cleanClientWord,
  clientWord,
  sayErrors,
  wordingFor,
} from "@/lib/client-word";
import { HELP_ARTICLES, helpArticles, sayArticle } from "@/lib/help-articles";
import { indexArticles, searchHelp } from "@/lib/help-search";

describe("the stored word", () => {
  it("keeps a known word, and stores the default as nothing", () => {
    expect(cleanClientWord("patients")).toBe("patients");
    expect(cleanClientWord("counselees")).toBe("counselees");
    expect(cleanClientWord("clients")).toBeNull();
    expect(cleanClientWord("")).toBeNull();
    expect(cleanClientWord(null)).toBeNull();
    expect(cleanClientWord("מטופלים")).toBeNull();
    expect(cleanClientWord(7)).toBeNull();
  });

  it("reads anything unknown as לקוחות", () => {
    expect(clientWord(null).label).toBe("לקוחות");
    expect(clientWord("nonsense").label).toBe("לקוחות");
    expect(clientWord("patients").label).toBe("מטופלים");
    expect(clientWord("counselees").label).toBe("נועצים");
  });
});

describe("the text in the account's word", () => {
  const patients = wordingFor("patients");
  const counselees = wordingFor("counselees");

  it("leaves a text as written for לקוחות or no choice", () => {
    for (const v of [null, undefined, "clients", "nonsense"]) {
      expect(wordingFor(v)("לקוח/ה חדש/ה, כל הלקוחות")).toBe("לקוח/ה חדש/ה, כל הלקוחות");
    }
  });

  it("maps every form", () => {
    expect(patients("לקוח")).toBe("מטופל");
    expect(patients("לקוחה")).toBe("מטופלת");
    expect(patients("לקוח/ה")).toBe("מטופל/ת");
    expect(patients("לקוחות")).toBe("מטופלים");
    expect(counselees("לקוח")).toBe("נועץ");
    expect(counselees("לקוחה")).toBe("נועצת");
    expect(counselees("לקוח/ה")).toBe("נועץ/ת");
    expect(counselees("לקוחות")).toBe("נועצים");
  });

  it("keeps the prefix letters", () => {
    expect(patients("כל הלקוחות")).toBe("כל המטופלים");
    expect(patients("תזכורות ללקוחות")).toBe("תזכורות למטופלים");
    expect(patients("פגישות ולקוחות")).toBe("פגישות ומטופלים");
    expect(patients("כשללקוח/ה אין מחיר משלו/ה")).toBe("כשלמטופל/ת אין מחיר משלו/ה");
    expect(counselees("הפיכה ללקוח")).toBe("הפיכה לנועץ");
    expect(counselees("הלקוח/ה שהמשימה נוגעת אליו/ה")).toBe("הנועץ/ת שהמשימה נוגעת אליו/ה");
  });

  it("rewrites whole sentences, every occurrence", () => {
    expect(patients("לקוח/ה חדש/ה")).toBe("מטופל/ת חדש/ה");
    expect(patients("לא נמצאו לקוחות בשם הזה")).toBe("לא נמצאו מטופלים בשם הזה");
    expect(patients("עוד אין לקוחות — הוספת לקוח חדש")).toBe("עוד אין מטופלים — הוספת מטופל חדש");
    expect(counselees("לקוחות.csv")).toBe("נועצים.csv");
    expect(patients("3 לקוחות פעילים, לקוח/ה אחד/ת בהמתנה")).toBe("3 מטופלים פעילים, מטופל/ת אחד/ת בהמתנה");
  });

  it("reads ״לקוח״ before another word's ה as the masculine form", () => {
    // "הלקוח הזה": the ה belongs to the next word
    expect(patients("הלקוח הזה")).toBe("המטופל הזה");
    expect(patients("לקוחה חדשה")).toBe("מטופלת חדשה");
  });

  it("leaves other text alone", () => {
    expect(patients("פגישה חדשה ביום ראשון")).toBe("פגישה חדשה ביום ראשון");
    expect(patients("")).toBe("");
  });

  it("keeps a word marked as written, and drops the mark", () => {
    const text = `${AS_WRITTEN}לקוחות, מטופלים או נועצים — לכל הלקוחות`;
    expect(patients(text)).toBe("לקוחות, מטופלים או נועצים — לכל המטופלים");
    expect(wordingFor(null)(text)).toBe("לקוחות, מטופלים או נועצים — לכל הלקוחות");
  });

  it("each word has all four forms", () => {
    for (const w of CLIENT_WORDS) {
      for (const form of [w.label, w.one, w.oneF, w.both, w.many]) expect(form.length).toBeGreaterThan(2);
      expect(w.label).toBe(w.many);
    }
  });

  it("rewrites a form's field errors", () => {
    const errors = { clientId: ["נדרש לקוח"], startAt: ["נדרש תאריך"], notes: undefined };
    expect(sayErrors(patients, errors)).toEqual({
      clientId: ["נדרש מטופל"],
      startAt: ["נדרש תאריך"],
      notes: undefined,
    });
  });
});

describe("help articles in the account's word", () => {
  const patients = wordingFor("patients");

  it("rewrites titles, summaries and bodies, and leaves no ״לקוח״ outside the document articles", () => {
    for (const documents of [true, false]) {
      for (const a of helpArticles(documents, patients)) {
        if (["invoices-receipts", "record-issued-document", "expenses"].includes(a.slug)) continue;
        const text = JSON.stringify({ ...a, keywords: [] });
        // the questionnaire's article names the word "לקוחות" itself, twice
        const kept = a.slug === "intro-questionnaire" ? 2 : 0;
        expect(text.match(/לקוח/g)?.length ?? 0, a.slug).toBe(kept);
        expect(text).not.toContain(AS_WRITTEN);
      }
    }
  });

  it("without a chosen word the articles read as written, without the mark", () => {
    const text = JSON.stringify(helpArticles(true));
    expect(text).not.toContain(AS_WRITTEN);
    expect(text).toContain("לקוחות");
    expect(helpArticles(true)).toHaveLength(HELP_ARTICLES.length);
  });

  it("the document articles keep ״לקוח״, the term of the document", () => {
    const article = HELP_ARTICLES.find((a) => a.slug === "invoices-receipts")!;
    expect(sayArticle(patients, article)).toBe(article);
  });

  it("a search finds an article by either word", () => {
    const index = indexArticles(helpArticles(false, patients));
    const byNew = searchHelp("הוספת מטופל", index).map((a) => a.slug);
    const byWritten = searchHelp("הוספת לקוח", index).map((a) => a.slug);
    expect(byNew.length).toBeGreaterThan(0);
    expect(byWritten).toContain(byNew[0]);
  });
});

// ---------------------------------------------------------------------------
// The guard: a screen text with "לקוח" has to go through `say`, or the account
// that chose another word sees both. Every "לקוח" in src (comments aside) is
// either inside a say(...) / sayTo(...) call, or in a file listed here with
// the reason it is fine.

/** Texts kept in data, passed through `say` where they are shown. */
const SAID_WHERE_SHOWN: Record<string, string> = {
  "src/lib/client-word.ts": "the words themselves",
  "src/lib/help-articles.ts": "helpArticles() → sayArticle()",
  "src/components/nav/nav-items.ts": "the three menus render say(item.label)",
  "src/components/ui/client-combobox.tsx": "FILTER_TEXTS, rebuilt through say in the component",
  "src/components/tasks/task-list.tsx": "CLIENT_TEXTS, passed to ClientCombobox which says them",
  "src/components/settings/audit-log-card.tsx": "ACTION_LABELS, rendered as say(ACTION_LABELS[...])",
  "src/lib/account-export-format.ts": "README_TEXT, written as say(README_TEXT)",
  "src/lib/account-export.ts": "csvEntry() says the file name and the column titles",
  "src/lib/client-trash.ts": "deletionContentsText(), returned through sayTo() by the action",
  "src/lib/my-clinic.ts": "section hints, rendered as say(s.hint)",
  "src/lib/onboarding.ts": "the wizard's subtitle, rendered as say(current.subtitle)",
  "src/lib/plans.ts": "plan features: said on /subscription, as written on the public pages",
  "src/server/validators/session.ts": "zod messages, returned through sayErrors() by the actions",
};

/** Kept as "לקוח" on purpose. */
const STAYS_AS_WRITTEN: [prefix: string, why: string][] = [
  ["src/app/(auth)/", "signed out: no account to ask"],
  ["src/app/layout.tsx", "signed out: the site's description"],
  ["src/app/manifest.ts", "signed out: the installed app's description"],
  ["src/components/landing/", "signed out"],
  ["src/lib/site.ts", "signed out: the site's description"],
  ["src/app/(app)/invoices/", "billing documents: לקוח is the document's term"],
  ["src/components/invoices/", "billing documents"],
  ["src/components/settings/document-email-card.tsx", "billing documents"],
  ["src/lib/billing-docs.ts", "billing documents"],
  ["src/lib/document-look.ts", "billing documents"],
  ["src/server/actions/documents.ts", "billing documents"],
  ["src/server/actions/invoices.ts", "billing documents"],
  ["src/server/validators/document.ts", "billing documents"],
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") sourceFiles(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** The source without comments (a `//` inside a URL stays). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

/** Is the text at `at` inside the parentheses of a say(...) / sayTo(...) call? */
export function insideSay(source: string, at: number): boolean {
  const calls = /(?<![\w.])(?:say|sayTo|tally\.say)\(/g;
  let open: RegExpExecArray | null;
  let last = -1;
  const from = Math.max(0, at - 1500);
  calls.lastIndex = from;
  const opens: number[] = [];
  while ((open = calls.exec(source)) && open.index < at) opens.push(open.index + open[0].length);
  // the nearest call whose parenthesis is still open at `at`
  for (let i = opens.length - 1; i >= 0; i--) {
    const between = source
      .slice(opens[i], at)
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    let depth = 1;
    for (const ch of between) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth === 0) break;
    }
    if (depth > 0) {
      last = opens[i]!;
      break;
    }
  }
  return last !== -1;
}

describe("no screen text names ״לקוח״ without going through say", () => {
  const root = join(process.cwd(), "src");
  const files = sourceFiles(root).map((path) => ({
    path,
    rel: relative(process.cwd(), path).replace(/\\/g, "/"),
  }));

  it("insideSay reads a call's parentheses", () => {
    const at = (s: string) => s.indexOf("לקוח");
    for (const inside of [
      'say("לקוח/ה")',
      '{say(ok ? "נשמר" : "לא נמצאו לקוחות")}',
      'error: await sayTo(userId, "לקוח לא נמצא")',
      'say(`${n} לקוחות`)',
      'say(count(n) + " לקוחות (פעילים)")',
    ]) {
      expect(insideSay(inside, at(inside)), inside).toBe(true);
    }
    for (const outside of [
      '<p>לקוח/ה</p>',
      'say("שלום") + "לקוח"',
      '{say("א")} <b>לקוחות</b>',
      'essay("לקוח")',
      'label="לקוח/ה"',
    ]) {
      expect(insideSay(outside, at(outside)), outside).toBe(false);
    }
  });

  it("every ״לקוח״ in src is said, listed as data, or kept on purpose", () => {
    const loose: string[] = [];
    for (const { path, rel } of files) {
      if (SAID_WHERE_SHOWN[rel]) continue;
      if (STAYS_AS_WRITTEN.some(([prefix]) => rel.startsWith(prefix))) continue;
      const source = withoutComments(readFileSync(path, "utf8"));
      for (const m of source.matchAll(/לקוח/g)) {
        if (insideSay(source, m.index)) continue;
        const line = source.slice(0, m.index).split("\n").length;
        loose.push(`${rel}:${line}`);
      }
    }
    expect(loose).toEqual([]);
  });

  it("the lists name files that exist and still hold the word", () => {
    const rels = new Set(files.map((f) => f.rel));
    for (const rel of Object.keys(SAID_WHERE_SHOWN)) {
      expect(rels.has(rel), rel).toBe(true);
      expect(readFileSync(join(process.cwd(), rel), "utf8"), rel).toContain("לקוח");
    }
    for (const [prefix] of STAYS_AS_WRITTEN) {
      const held = files.filter((f) => f.rel.startsWith(prefix));
      expect(held.length, prefix).toBeGreaterThan(0);
      expect(
        held.some((f) => withoutComments(readFileSync(f.path, "utf8")).includes("לקוח")),
        prefix,
      ).toBe(true);
    }
  });
});
