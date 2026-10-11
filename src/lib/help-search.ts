// Client-side search over the help articles (src/lib/help-articles.ts).
// Hebrew-friendly: niqqud, quote marks (גרש/גרשיים) and final letters are
// ignored, and a word also matches without a leading prefix letter
// (ו/ה/ב/ל/מ/ש/כ — "בחשבונית" finds "חשבונית") or a plural ending ("פגישות"
// finds "פגישה"). Every word of the query must match somewhere.

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "tip"; text: string }
  | { type: "link"; href: string; label: string };

export type HelpArticle = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  body: HelpBlock[];
};

const FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/** Lower-case, no niqqud/cantillation, no quote marks, final letters → regular. */
export function normalizeHebrew(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // niqqud & cantillation
    .replace(/["'`״׳‘’“”]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const PREFIX_LETTERS = new Set(["ו", "ה", "ב", "ל", "מ", "ש", "כ"]);

/** The forms a query word may take in the text (longest first). */
export function wordVariants(word: string): string[] {
  const out = new Set<string>([word]);
  const isHebrew = /^[א-ת]/.test(word);
  if (!isHebrew) return [...out];
  // Up to two prefix letters ("וה", "של", "מה"...), keeping at least 3 letters
  let w = word;
  for (let i = 0; i < 2; i++) {
    if (w.length > 3 && PREFIX_LETTERS.has(w[0]!)) {
      w = w.slice(1);
      out.add(w);
    } else break;
  }
  // Plural / construct endings: פגישות → פגיש, מטופלים → מטופל. The word is
  // already normalized, so a final ם arrives as מ.
  for (const base of [...out]) {
    for (const suffix of ["יות", "ות", "ימ", "ה", "ת"]) {
      if (base.length - suffix.length >= 3 && base.endsWith(suffix)) {
        out.add(base.slice(0, -suffix.length));
      }
    }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function blockText(b: HelpBlock): string {
  switch (b.type) {
    case "p":
    case "tip":
      return b.text;
    case "steps":
    case "bullets":
      return b.items.join(" ");
    case "link":
      return b.label;
  }
}

type Indexed = {
  article: HelpArticle;
  title: string;
  keywords: string;
  summary: string;
  body: string;
};

export function indexArticles(articles: HelpArticle[]): Indexed[] {
  return articles.map((a) => ({
    article: a,
    title: normalizeHebrew(a.title),
    keywords: normalizeHebrew(a.keywords.join(" ") + " " + a.category),
    summary: normalizeHebrew(a.summary),
    body: normalizeHebrew(a.body.map(blockText).join(" ")),
  }));
}

const RELATIVE_CUTOFF = 0.3;

/** Matching articles, best first. An empty query returns nothing. */
export function searchHelp(
  query: string,
  articles: HelpArticle[] | Indexed[],
): HelpArticle[] {
  const words = normalizeHebrew(query).split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const index: Indexed[] =
    articles.length > 0 && "article" in articles[0]!
      ? (articles as Indexed[])
      : indexArticles(articles as HelpArticle[]);

  const scored: { article: HelpArticle; score: number; order: number }[] = [];
  index.forEach((entry, order) => {
    let score = 0;
    for (const word of words) {
      const variants = wordVariants(word);
      let best = 0;
      for (const v of variants) {
        // A shortened form counts less than the word as typed, and a very
        // short stem ("קבל" from "קבלות") much less — it matches loosely
        const exact = v === word ? 1 : v.length >= 4 ? 0.8 : 0.5;
        if (entry.title.includes(v)) best = Math.max(best, 6 * exact);
        else if (entry.keywords.includes(v)) best = Math.max(best, 4 * exact);
        else if (entry.summary.includes(v)) best = Math.max(best, 2 * exact);
        else if (entry.body.includes(v)) best = Math.max(best, 1 * exact);
      }
      if (best === 0) return; // every word must match
      score += best;
    }
    scored.push({ article: entry.article, score, order });
  });

  // Drop weak tail matches (a loose stem somewhere in a body) when there are
  // much better ones
  const best = Math.max(0, ...scored.map((s) => s.score));
  return scored
    .filter((s) => s.score >= best * RELATIVE_CUTOFF)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((s) => s.article);
}
