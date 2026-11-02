import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// The income-document form on a real Postgres, with morning stubbed at the
// module boundary. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "document_form");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return {
    actor: { id: null as string | null },
    payloads: [] as Record<string, unknown>[],
    morning: { mode: "ok" as "ok" | "refused" | "no-answer" },
  };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/morning", async (original) => {
  const real = await original<typeof import("@/lib/morning")>();
  return {
    ...real,
    createMorningDocument: async (_o: string, _c: unknown, payload: Record<string, unknown>) => {
      mocks.payloads.push(payload);
      if (mocks.morning.mode === "refused") return { ok: false, error: "morning 422: refused" };
      if (mocks.morning.mode === "no-answer") return { ok: false, uncertain: true, error: "timeout" };
      return { ok: true, data: { id: `stub-${mocks.payloads.length}`, number: 7000 + mocks.payloads.length, url: {} } };
    },
  };
});

type Db = typeof import("@/lib/db").db;

const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    kind: "TAX_INVOICE",
    clientId: "",
    clientName: "אורח לדוגמה",
    clientTaxId: "123456782",
    clientEmails: [],
    date: "2026-11-02",
    dueDate: "2026-11-30",
    currency: "ILS",
    vatIncluded: true,
    items: [{ description: "ייעוץ", quantity: 1, unitPrice: "500" }],
    payments: [],
    sessionIds: [],
    ...over,
  });

describe.skipIf(!TEST_DATABASE_URL)("income-document form (real Postgres, morning stubbed)", () => {
  let db: Db;
  let a: Practice;
  let b: Practice;
  let save: typeof import("@/server/actions/documents").saveDocumentAction;
  let issue: typeof import("@/server/actions/documents").issueDocumentAction;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("document_form");
    db = (await import("@/lib/db")).db;
    const actions = await import("@/server/actions/documents");
    save = actions.saveDocumentAction;
    issue = actions.issueDocumentAction;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db as never);
    a = await seedPractice(db as never, "A");
    b = await seedPractice(db as never, "B");
    await db.user.updateMany({ data: { vatLiable: true } });
    mocks.actor.id = a.userId;
    mocks.payloads.length = 0;
    mocks.morning.mode = "ok";
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  it("issues to a one-off client without creating a client", async () => {
    const before = await db.client.count({ where: { userId: a.userId } });
    const r = await save(
      body({ clientEmails: ["one@example.test", "two@example.test"], currency: "USD" }),
      "issue",
    );
    expect(r.issue?.ok).toBe(true);
    expect(await db.client.count({ where: { userId: a.userId } })).toBe(before);

    const inv = await db.invoice.findFirstOrThrow({ where: { id: r.invoiceId, userId: a.userId } });
    expect(inv.clientId).toBeNull();
    expect(inv.docClientName).toBe("אורח לדוגמה");
    expect(inv.morningDocNumber).toBe("7001");
    expect(inv.currency).toBe("USD");

    const p = mocks.payloads[0];
    expect(p.dueDate).toBe("2026-11-30");
    expect(p.currency).toBe("USD");
    expect(p.client).toEqual({
      name: "אורח לדוגמה",
      taxId: "123456782",
      emails: ["one@example.test", "two@example.test"],
      add: false,
    });
    expect((p.income as { currency: string }[])[0].currency).toBe("USD");
  });

  it("keeps an unfinished form as a draft, refuses to issue it, and refuses an empty one", async () => {
    const empty = await save(body({ clientName: "", items: [] }), "draft");
    expect(empty.invoiceId).toBeUndefined();
    expect(empty.problems?.[0]).toContain("אין עדיין מה לשמור");

    const partial = await save(
      body({ items: [{ description: "", quantity: 1, unitPrice: "" }] }),
      "draft",
    );
    expect(partial.invoiceId).toBeTruthy();

    const issued = await issue(partial.invoiceId!);
    expect(issued.ok).toBe(false);
    expect(mocks.payloads).toHaveLength(0);
  });

  it("edits a saved draft in place", async () => {
    const first = await save(body(), "draft");
    const count = await db.invoice.count({ where: { userId: a.userId } });
    const second = await save(
      body({ draftId: first.invoiceId, clientName: "שם אחר", items: [{ description: "אחר", quantity: 2, unitPrice: "100" }] }),
      "draft",
    );
    expect(second.invoiceId).toBe(first.invoiceId);
    expect(await db.invoice.count({ where: { userId: a.userId } })).toBe(count);
    const inv = await db.invoice.findFirstOrThrow({
      where: { id: first.invoiceId },
      include: { items: true },
    });
    expect(inv.docClientName).toBe("שם אחר");
    expect(inv.items.map((i) => i.description)).toEqual(["אחר"]);
    expect(Number(inv.total)).toBe(200);
  });

  it("won't let one practice overwrite another's draft, or edit an issued document", async () => {
    const mine = await save(body(), "draft");
    mocks.actor.id = b.userId;
    const theirs = await save(body({ draftId: mine.invoiceId, clientName: "פולש" }), "draft");
    expect(theirs.error).toBeTruthy();
    mocks.actor.id = a.userId;
    const inv = await db.invoice.findFirstOrThrow({ where: { id: mine.invoiceId } });
    expect(inv.docClientName).toBe("אורח לדוגמה");

    const done = await save(body(), "issue");
    const again = await save(body({ draftId: done.invoiceId, clientName: "שינוי" }), "draft");
    expect(again.error).toBeTruthy();
  });

  it("links ticked meetings only when the document is issued, and never prints them", async () => {
    const ticked = body({ clientId: a.clientId, sessionIds: [a.pastSessionId] });
    const draft = await save(ticked, "draft");
    const sessionBefore = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: true },
    });
    expect(sessionBefore.morningDocNumber).toBeNull();
    expect(sessionBefore.invoiceItem).toBeNull();

    const r = await issue(draft.invoiceId!);
    expect(r.ok).toBe(true);
    const session = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: { select: { linkOnly: true, invoiceId: true } } },
    });
    expect(session.morningDocNumber).toBe("7001");
    expect(session.invoiceItem).toEqual({ linkOnly: true, invoiceId: draft.invoiceId });

    // One printed line went to morning, and no trace of the meeting
    const p = mocks.payloads[0];
    expect((p.income as unknown[]).length).toBe(1);
    expect(JSON.stringify(p)).not.toContain(a.pastSessionId);
    expect(JSON.stringify(p)).not.toContain("פגישה");

    const stored = await db.invoice.findUniqueOrThrow({ where: { id: draft.invoiceId } });
    expect(stored.draftSessionIds).toEqual([]);
  });

  it.each(["refused", "no-answer"] as const)("a failed issue (%s) keeps the draft and leaves no link", async (mode) => {
    mocks.morning.mode = mode;
    const r = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }), "issue");
    expect(r.invoiceId).toBeTruthy();
    expect(r.issue?.ok).toBe(false);

    const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId }, include: { items: true } });
    expect(inv.morningDocId).toBeNull();
    expect(inv.items.map((i) => i.description)).toEqual(["ייעוץ"]);
    expect(inv.draftSessionIds).toEqual([a.pastSessionId]);

    const session = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: true },
    });
    expect(session.morningDocNumber).toBeNull();
    expect(session.invoiceItem).toBeNull();
  });

  it("stops before morning if a ticked meeting was billed in the meantime", async () => {
    const first = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }), "draft");
    const second = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }), "draft");
    expect((await issue(first.invoiceId!)).ok).toBe(true);
    const r = await issue(second.invoiceId!);
    expect(r.ok).toBe(false);
    expect(mocks.payloads).toHaveLength(1);
  });

  describe("credit notes as their own form", () => {
    const credit = (over: Record<string, unknown> = {}) =>
      body({ kind: "CREDIT_NOTE", dueDate: "", clientTaxId: "", ...over });

    it("issues one with no linked document, and cancels nothing", async () => {
      const r = await save(credit(), "issue");
      expect(r.issue?.ok).toBe(true);
      const p = mocks.payloads[0];
      expect(p.type).toBe(330);
      expect(p.linkedDocumentIds).toBeUndefined();
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      expect(orig.status).not.toBe("CANCELLED");
    });

    it("cancels the original when linked and the amounts match", async () => {
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      const r = await save(
        credit({
          clientId: orig.clientId,
          relatedInvoiceId: orig.id,
          items: [{ description: "זיכוי", quantity: 1, unitPrice: orig.total.toString() }],
        }),
        "issue",
      );
      expect(r.issue?.ok).toBe(true);
      expect(mocks.payloads[0].linkedDocumentIds).toEqual([orig.morningDocId]);
      expect(mocks.payloads[0].linkType).toBe("cancel");
      const after = await db.invoice.findUniqueOrThrow({ where: { id: orig.id } });
      expect(after.status).toBe("CANCELLED");
    });

    it("won't link a credit that doesn't add up to the original", async () => {
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      const r = await save(
        credit({
          clientId: orig.clientId,
          relatedInvoiceId: orig.id,
          items: [{ description: "זיכוי חלקי", quantity: 1, unitPrice: "1" }],
        }),
        "issue",
      );
      expect(r.invoiceId).toBeUndefined();
      expect(r.problems?.[0]).toContain("זיכוי חלקי");
      expect(mocks.payloads).toHaveLength(0);
    });

    it("isn't open to an exempt business", async () => {
      await db.user.update({ where: { id: a.userId }, data: { vatLiable: false } });
      expect((await save(credit(), "draft")).invoiceId).toBeUndefined();
    });

    it("takes no meetings", async () => {
      const r = await save(credit({ clientId: a.clientId, sessionIds: [a.pastSessionId] }), "draft");
      const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId } });
      expect(inv.draftSessionIds).toEqual([]);
    });
  });

  it("sends the document's settings to morning", async () => {
    await save(body({ lang: "en", vatType: 1, rounding: true }), "issue");
    const p = mocks.payloads[0];
    expect(p.lang).toBe("en");
    expect(p.vatType).toBe(1);
    expect(p.rounding).toBe(true);
    expect((p.income as { vatType: number }[])[0].vatType).toBe(2);
  });

  it("issues a receipt with several lines and no income lines of its own", async () => {
    const r = await save(
      body({
        kind: "RECEIPT",
        dueDate: "",
        items: [],
        payments: [
          { method: "BIT", date: "2026-11-02", amount: "100", reference: "A1" },
          { method: "BANK_TRANSFER", date: "2026-11-02", amount: "50", bankName: "בנק", bankBranch: "1", bankAccount: "2" },
        ],
      }),
      "issue",
    );
    expect(r.issue?.ok).toBe(true);
    const p = mocks.payloads[0];
    expect(p.payment).toHaveLength(2);
    expect((p.payment as { transactionId?: string }[])[0].transactionId).toBe("A1");
    expect((p.payment as { bankName?: string }[])[1].bankName).toBe("בנק");
  });

  it("refuses receipts that don't add up to the document", async () => {
    const r = await save(
      body({ kind: "TAX_INVOICE_RECEIPT", payments: [{ method: "CASH", date: "2026-11-02", amount: "1" }] }),
      "issue",
    );
    expect(r.invoiceId).toBeUndefined();
    expect(r.problems?.join(" ")).toContain("סכום התקבולים");
  });

  it("refuses another practice's client or meeting", async () => {
    expect((await save(body({ clientId: b.clientId }), "draft")).invoiceId).toBeUndefined();
    const r = await save(body({ clientId: a.clientId, sessionIds: [b.pastSessionId] }), "draft");
    expect(r.invoiceId).toBeUndefined();
  });

  it("doesn't take meetings for a one-off client", async () => {
    const r = await save(body({ sessionIds: [a.pastSessionId] }), "draft");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId } });
    expect(inv.draftSessionIds).toEqual([]);
  });
});
