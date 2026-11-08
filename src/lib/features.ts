// Feature switches. Pure and safe to import anywhere; the server reads the
// environment, client components get the answer as a prop (never read
// process.env in the browser: it is empty there).
//
// Income and expense documents ("מסמכי הכנסות" / "מסמכי הוצאות") are hidden
// until the app can issue documents legally (the Tax Authority's software
// registration). One Railway variable brings them back: DOCUMENTS_ENABLED=true.
// Hidden means: no menu items, links, buttons, settings tab or help articles;
// their pages redirect to /dashboard and their actions and API routes refuse.
// Nothing is deleted: tables, rows and the money rules stay exactly as they are,
// so documents already recorded still count in income, debt and reports.

type Env = Record<string, string | undefined>;

/** The one switch. Anything other than "true" (any case) keeps documents hidden. */
export function documentsEnabled(env: Env = process.env): boolean {
  return (env.DOCUMENTS_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** What an action or API route answers while documents are hidden. */
export const DOCUMENTS_OFF_ERROR = "מסמכי הכנסות והוצאות אינם זמינים כרגע.";

/** Where the hidden pages send a visitor. */
export const DOCUMENTS_OFF_PATH = "/dashboard";

/** The app's own pages that belong to documents. */
export const DOCUMENT_PAGE_PREFIXES = ["/invoices", "/expenses"] as const;

/** Is this address one of the document pages (or below one)? */
export function isDocumentsPath(href: string): boolean {
  const path = href.split(/[?#]/)[0];
  return DOCUMENT_PAGE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Keeps only what may be shown: everything when on, no document pages when off. */
export function withoutDocumentLinks<T extends { href: string }>(items: readonly T[], documents: boolean): T[] {
  return documents ? [...items] : items.filter((i) => !isDocumentsPath(i.href));
}
