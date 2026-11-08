import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOCUMENTS_OFF_ERROR,
  documentsEnabled,
  isDocumentsPath,
  withoutDocumentLinks,
} from "@/lib/features";
import { NAV_ITEMS, navItems, primaryMobileItems } from "@/components/nav/nav-items";
import { parseSettingsTab, settingsTabs } from "@/lib/settings-tabs";
import {
  DOCUMENT_HELP_SLUGS,
  HELP_ARTICLES,
  helpArticles,
  popularHelpSlugs,
} from "@/lib/help-articles";
import { indexArticles, searchHelp } from "@/lib/help-search";

// Income and expense documents are hidden until the app can issue them
// (src/lib/features.ts): one variable, DOCUMENTS_ENABLED=true, brings them
// back. Everything else in `npm test` runs with them on (vitest.config.ts);
// here they are off.

// Nothing may be read or written while they are off: the database and the
// session are fakes, and any use of the database fails the test.
const dbTouched: string[] = [];
vi.mock("@/lib/db", () => {
  const db = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return undefined;
      dbTouched.push(String(prop));
      throw new Error(`database used while documents are off (${String(prop)})`);
    },
  });
  return { db, dbAll: db };
});
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "user-a" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");

/** next/navigation's redirect() throws; its digest names the target. */
async function redirectTarget(run: () => unknown): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    const digest = String((e as { digest?: unknown }).digest ?? "");
    if (!digest.startsWith("NEXT_REDIRECT")) throw e;
    return digest.split(";")[2] ?? null;
  }
}

describe("the switch", () => {
  it("is on only for DOCUMENTS_ENABLED=true", () => {
    expect(documentsEnabled({})).toBe(false);
    expect(documentsEnabled({ DOCUMENTS_ENABLED: "" })).toBe(false);
    expect(documentsEnabled({ DOCUMENTS_ENABLED: "false" })).toBe(false);
    expect(documentsEnabled({ DOCUMENTS_ENABLED: "1" })).toBe(false);
    expect(documentsEnabled({ DOCUMENTS_ENABLED: "true" })).toBe(true);
    expect(documentsEnabled({ DOCUMENTS_ENABLED: " TRUE " })).toBe(true);
  });

  it("knows the document pages", () => {
    expect(isDocumentsPath("/invoices")).toBe(true);
    expect(isDocumentsPath("/invoices/new?kind=RECEIPT")).toBe(true);
    expect(isDocumentsPath("/invoices/abc")).toBe(true);
    expect(isDocumentsPath("/expenses?view=drafts")).toBe(true);
    expect(isDocumentsPath("/expenses/abc")).toBe(true);
    expect(isDocumentsPath("/invoicesx")).toBe(false);
    expect(isDocumentsPath("/collect")).toBe(false);
    expect(isDocumentsPath("/reports")).toBe(false);
    expect(withoutDocumentLinks([{ href: "/invoices" }, { href: "/reports" }], false)).toEqual([{ href: "/reports" }]);
    expect(withoutDocumentLinks([{ href: "/invoices" }], true)).toEqual([{ href: "/invoices" }]);
  });
});

describe("what a user can reach while documents are off", () => {
  it("the menus (sidebar, phone drawer, bottom bar) have no document pages", () => {
    const off = navItems(false).map((i) => i.href);
    expect(off).not.toContain("/invoices");
    expect(off).not.toContain("/expenses");
    expect(off).toEqual(NAV_ITEMS.map((i) => i.href).filter((h) => !isDocumentsPath(h)));
    expect(primaryMobileItems(false).map((i) => i.href)).toEqual(["/dashboard", "/calendar", "/clients"]);
    // on: as before
    expect(navItems(true)).toEqual(NAV_ITEMS);
    expect(primaryMobileItems(true).map((i) => i.href)).toContain("/invoices");
  });

  it("settings have no documents tab, and its address opens the first tab", () => {
    expect(settingsTabs(false, false).map((t) => t.key)).not.toContain("documents");
    expect(settingsTabs(true, false).map((t) => t.key)).toContain("admin");
    expect(parseSettingsTab("documents", false, false)).toBe("personal");
    expect(parseSettingsTab("business", false, false)).toBe("business");
    expect(settingsTabs(false, true).map((t) => t.key)).toContain("documents");
  });

  it("help has no document articles, and nothing in it links to a document page", () => {
    const off = helpArticles(false);
    for (const slug of DOCUMENT_HELP_SLUGS) expect(off.map((a) => a.slug)).not.toContain(slug);
    for (const a of off) {
      for (const b of a.body) if (b.type === "link") expect(isDocumentsPath(b.href)).toBe(false);
      const text = JSON.stringify(a.body);
      expect(text).not.toContain("מסמך חדש");
      expect(text).not.toContain("מסמכי הכנסות");
      expect(text).not.toContain("מסמכי הוצאות");
      expect(text).not.toContain("הגדרות מסמכים");
    }
    const slugs = new Set(off.map((a) => a.slug));
    for (const s of popularHelpSlugs(false)) expect(slugs.has(s)).toBe(true);
    expect(off.length).toBeGreaterThanOrEqual(8);
    // on: every article as before
    expect(helpArticles(true)).toBe(HELP_ARTICLES);
  });

  it("help search finds no hidden article, and still finds how to record a number", () => {
    const index = indexArticles(helpArticles(false));
    const hidden = new Set<string>(DOCUMENT_HELP_SLUGS);
    for (const q of ["קבלה", "חשבונית", "הוצאות", "מסמך שהופק", "טיוטה"]) {
      for (const a of searchHelp(q, index)) expect(hidden.has(a.slug)).toBe(false);
    }
    expect(searchHelp("מסמך שהופק", index).map((a) => a.slug)[0]).toBe("record-payment");
    expect(searchHelp("מורנינג", index).map((a) => a.slug)).toContain("record-payment");
  });
});

/** Every page file under (app)/invoices and (app)/expenses. */
function documentPages(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "page.tsx") out.push(p);
    }
  };
  walk(path.join(APP, "(app)", "invoices"));
  walk(path.join(APP, "(app)", "expenses"));
  return out;
}

/** Every API route under /api/invoices and /api/expenses. */
function documentRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^route\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(path.join(APP, "api", "invoices"));
  walk(path.join(APP, "api", "expenses"));
  return out;
}

/** Actions that exist only for the document pages. */
const GATED_ACTIONS: Record<string, string[]> = {
  documents: ["saveDocumentAction", "creditNoteAction", "recordDocumentNumberAction"],
  expenses: ["uploadExpenseAction", "saveExpenseAction", "deleteExpenseAction"],
  invoices: ["markInvoiceSentAction", "cancelInvoiceAction", "sendInvoiceEmailAction"],
  payments: ["recordPaymentAction", "deletePaymentAction"],
  "document-numbers": ["assignImportedDocumentAction"],
  settings: [
    "updateDocumentDefaultsAction",
    "updateDocumentLookAction",
    "updateDocumentEmailAction",
    "updateDocumentNumberingAction",
  ],
};

describe("every way in is covered (a new page, route or action fails here)", () => {
  it("each document page and both layouts check the switch first", () => {
    const pages = documentPages();
    expect(pages.length).toBe(5);
    for (const p of pages) {
      const src = fs.readFileSync(p, "utf8");
      const body = src.slice(src.indexOf("export default"));
      const firstStatement = body.slice(body.indexOf(") {") + 3).split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("//"));
      expect(firstStatement, p).toBe("requireDocumentsPage();");
    }
    for (const seg of ["invoices", "expenses"]) {
      const src = fs.readFileSync(path.join(APP, "(app)", seg, "layout.tsx"), "utf8");
      expect(src).toMatch(/requireDocumentsPage\(\)/);
    }
  });

  it("each document API route refuses first", () => {
    const routes = documentRoutes();
    expect(routes.length).toBe(3);
    for (const r of routes) {
      const src = fs.readFileSync(r, "utf8");
      const body = src.slice(src.indexOf("export async function GET"));
      expect(body.slice(0, 400), r).toMatch(/const off = documentsOffResponse\(\);\s+if \(off\) return off;/);
    }
  });

  it("every exported action of the document-only files is gated", () => {
    for (const file of ["documents", "expenses", "invoices", "payments"]) {
      const src = fs.readFileSync(path.join(ROOT, "src", "server", "actions", `${file}.ts`), "utf8");
      const names = [...src.matchAll(/^export async function (\w+)\s*\(/gm)].map((m) => m[1]);
      expect(names.sort(), file).toEqual([...GATED_ACTIONS[file]].sort());
    }
    for (const [file, names] of Object.entries(GATED_ACTIONS)) {
      const src = fs.readFileSync(path.join(ROOT, "src", "server", "actions", `${file}.ts`), "utf8");
      for (const name of names) {
        const start = src.indexOf(`export async function ${name}(`);
        expect(start, `${file}.${name}`).toBeGreaterThanOrEqual(0);
        const next = src.indexOf("\nexport ", start + 10);
        const body = src.slice(start, next === -1 ? undefined : next);
        expect(body, `${file}.${name}`).toMatch(/if \(!documentsEnabled\(\)\)/);
      }
    }
  });
});

describe("refused while off, before anything is read", () => {
  beforeEach(() => {
    vi.stubEnv("DOCUMENTS_ENABLED", "false");
    dbTouched.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    expect(dbTouched).toEqual([]);
  });

  const fd = () => new FormData();

  it("the actions answer with the reason (or send to /dashboard)", async () => {
    const documents = await import("@/server/actions/documents");
    expect(await documents.saveDocumentAction("{}")).toEqual({ error: DOCUMENTS_OFF_ERROR });
    expect(await documents.creditNoteAction("x")).toEqual({ error: DOCUMENTS_OFF_ERROR });
    expect(await documents.recordDocumentNumberAction("x", "1")).toEqual({ error: DOCUMENTS_OFF_ERROR });

    const expenses = await import("@/server/actions/expenses");
    expect(await expenses.uploadExpenseAction(fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });
    expect(await expenses.saveExpenseAction(fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });
    expect(await expenses.deleteExpenseAction(fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });

    const invoices = await import("@/server/actions/invoices");
    expect(await redirectTarget(() => invoices.markInvoiceSentAction(fd()))).toBe("/dashboard");
    expect(await redirectTarget(() => invoices.cancelInvoiceAction(fd()))).toBe("/dashboard");
    expect(await invoices.sendInvoiceEmailAction(null, fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });

    const payments = await import("@/server/actions/payments");
    expect(await payments.recordPaymentAction(null, fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });
    expect(await redirectTarget(() => payments.deletePaymentAction(fd()))).toBe("/dashboard");

    const numbers = await import("@/server/actions/document-numbers");
    expect(await redirectTarget(() => numbers.assignImportedDocumentAction(fd()))).toBe("/dashboard");

    const settings = await import("@/server/actions/settings");
    for (const action of [
      settings.updateDocumentDefaultsAction,
      settings.updateDocumentLookAction,
      settings.updateDocumentEmailAction,
      settings.updateDocumentNumberingAction,
    ]) {
      expect(await action(null, fd())).toEqual({ error: DOCUMENTS_OFF_ERROR });
    }
  });

  it("the API routes answer 403 with the reason", async () => {
    const params = { params: Promise.resolve({ id: "x" }) };
    const list = await import("@/app/api/invoices/documents/route");
    const pdf = await import("@/app/api/invoices/[id]/pdf/route");
    const expense = await import("@/app/api/expenses/[id]/route");
    for (const res of [
      await list.GET(new Request("http://localhost/api/invoices/documents")),
      await pdf.GET(new Request("http://localhost/api/invoices/x/pdf"), params),
      await expense.GET(new Request("http://localhost/api/expenses/x"), params),
    ]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: DOCUMENTS_OFF_ERROR });
    }
  });

  it("the pages send to /dashboard", async () => {
    const sp = { searchParams: Promise.resolve({}) };
    const id = { params: Promise.resolve({ id: "x" }) };
    const pages = [
      () => import("@/app/(app)/invoices/page").then((m) => m.default(sp)),
      () => import("@/app/(app)/invoices/new/page").then((m) => m.default(sp)),
      () => import("@/app/(app)/invoices/[id]/page").then((m) => m.default({ ...id, ...sp })),
      () => import("@/app/(app)/expenses/page").then((m) => m.default(sp)),
      () => import("@/app/(app)/expenses/[id]/page").then((m) => m.default(id)),
      () => import("@/app/(app)/invoices/layout").then((m) => m.default({ children: null })),
      () => import("@/app/(app)/expenses/layout").then((m) => m.default({ children: null })),
    ];
    for (const open of pages) expect(await redirectTarget(open)).toBe("/dashboard");
  });
});
