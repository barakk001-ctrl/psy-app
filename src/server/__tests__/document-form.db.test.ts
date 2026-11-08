import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// The income-document form on a real Postgres. The app doesn't issue documents
// (morning was removed on 2026-11-08): a document is saved as a draft, and it
// counts as issued once the number of the document issued elsewhere is
// recorded on it. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "document_form");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null } };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

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

describe.skipIf(!TEST_DATABASE_URL)("income-document form (real Postgres)", () => {
  let db: Db;
  let a: Practice;
  let b: Practice;
  let save: typeof import("@/server/actions/documents").saveDocumentAction;
  let record: typeof import("@/server/actions/documents").recordDocumentNumberAction;
  let creditNote: typeof import("@/server/actions/documents").creditNoteAction;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("document_form");
    db = (await import("@/lib/db")).db;
    const actions = await import("@/server/actions/documents");
    save = actions.saveDocumentAction;
    record = actions.recordDocumentNumberAction;
    creditNote = actions.creditNoteAction;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db as never);
    a = await seedPractice(db as never, "A");
    b = await seedPractice(db as never, "B");
    await db.user.updateMany({ data: { vatLiable: true } });
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  it("saves a one-off client's document as a draft, without creating a client", async () => {
    const before = await db.client.count({ where: { userId: a.userId } });
    const r = await save(body({ clientEmails: ["one@example.test", "two@example.test"], currency: "USD" }));
    expect(r.invoiceId).toBeTruthy();
    expect(await db.client.count({ where: { userId: a.userId } })).toBe(before);

    const inv = await db.invoice.findFirstOrThrow({ where: { id: r.invoiceId, userId: a.userId } });
    expect(inv.clientId).toBeNull();
    expect(inv.docClientName).toBe("אורח לדוגמה");
    expect(inv.docClientEmail).toBe("one@example.test, two@example.test");
    expect(inv.currency).toBe("USD");
    // A draft: no number, so it isn't money yet
    expect(inv.morningDocNumber).toBeNull();
    expect(inv.morningDocId).toBeNull();
    expect(inv.status).toBe("DRAFT");
  });

  it("keeps an unfinished form as a draft, won't record a number on it, and refuses an empty one", async () => {
    const empty = await save(body({ clientName: "", items: [] }));
    expect(empty.invoiceId).toBeUndefined();
    expect(empty.problems?.[0]).toContain("אין עדיין מה לשמור");

    const partial = await save(body({ items: [{ description: "", quantity: 1, unitPrice: "" }] }));
    expect(partial.invoiceId).toBeTruthy();

    const r = await record(partial.invoiceId!, "20500");
    expect(r.error).toContain("להשלים את הטיוטה");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: partial.invoiceId } });
    expect(inv.morningDocNumber).toBeNull();
  });

  it("edits a saved draft in place", async () => {
    const first = await save(body());
    const count = await db.invoice.count({ where: { userId: a.userId } });
    const second = await save(
      body({ draftId: first.invoiceId, clientName: "שם אחר", items: [{ description: "אחר", quantity: 2, unitPrice: "100" }] }),
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

  it("won't let one practice overwrite another's draft, or edit a document with a number", async () => {
    const mine = await save(body());
    mocks.actor.id = b.userId;
    const theirs = await save(body({ draftId: mine.invoiceId, clientName: "פולש" }));
    expect(theirs.error).toBeTruthy();
    expect(await record(mine.invoiceId!, "999")).toEqual({ error: "המסמך לא נמצא." });
    mocks.actor.id = a.userId;
    const inv = await db.invoice.findFirstOrThrow({ where: { id: mine.invoiceId } });
    expect(inv.docClientName).toBe("אורח לדוגמה");
    expect(inv.morningDocNumber).toBeNull();

    expect(await record(mine.invoiceId!, "20017")).toEqual({ saved: true });
    const again = await save(body({ draftId: mine.invoiceId, clientName: "שינוי" }));
    expect(again.error).toBeTruthy();
  });

  it("records only digits, and never on a cancelled draft", async () => {
    const d = await save(body());
    expect((await record(d.invoiceId!, "A-12")).error).toContain("ספרות");
    await db.invoice.update({ where: { id: d.invoiceId }, data: { status: "CANCELLED" } });
    expect((await record(d.invoiceId!, "12")).error).toContain("בוטל");
  });

  it("links ticked meetings only when the number is recorded, and never prints them", async () => {
    const draft = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }));
    const sessionBefore = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: true },
    });
    expect(sessionBefore.morningDocNumber).toBeNull();
    expect(sessionBefore.invoiceItem).toBeNull();

    expect(await record(draft.invoiceId!, "20500")).toEqual({ saved: true });
    const session = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: { select: { linkOnly: true, invoiceId: true } } },
    });
    expect(session).toEqual({ morningDocNumber: "20500", invoiceItem: { linkOnly: true, invoiceId: draft.invoiceId } });

    const stored = await db.invoice.findUniqueOrThrow({ where: { id: draft.invoiceId }, include: { items: true } });
    expect(stored.draftSessionIds).toEqual([]);
    expect(stored.status).toBe("SENT");
    // The printed lines are still only what she typed
    expect(stored.items.filter((i) => !i.linkOnly).map((i) => i.description)).toEqual(["ייעוץ"]);
  });

  it("a meeting billed by another document meanwhile isn't linked twice", async () => {
    const first = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }));
    const second = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }));
    expect(await record(first.invoiceId!, "1")).toEqual({ saved: true });
    expect(await record(second.invoiceId!, "2")).toEqual({ saved: true });
    const s = await db.session.findUniqueOrThrow({
      where: { id: a.pastSessionId },
      select: { morningDocNumber: true, invoiceItem: { select: { invoiceId: true } } },
    });
    expect(s).toEqual({ morningDocNumber: "1", invoiceItem: { invoiceId: first.invoiceId } });
  });

  describe("credit notes as their own form", () => {
    const credit = (over: Record<string, unknown> = {}) =>
      body({ kind: "CREDIT_NOTE", dueDate: "", clientTaxId: "", ...over });

    it("records one with no linked document, and cancels nothing", async () => {
      const r = await save(credit());
      expect(await record(r.invoiceId!, "300")).toEqual({ saved: true });
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      expect(orig.status).not.toBe("CANCELLED");
    });

    it("cancels the original once its number is recorded, when linked and the amounts match", async () => {
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      const r = await save(
        credit({
          clientId: orig.clientId,
          relatedInvoiceId: orig.id,
          items: [{ description: "זיכוי", quantity: 1, unitPrice: orig.total.toString() }],
        }),
      );
      expect(r.invoiceId).toBeTruthy();
      expect((await db.invoice.findUniqueOrThrow({ where: { id: orig.id } })).status).not.toBe("CANCELLED");
      expect(await record(r.invoiceId!, "301")).toEqual({ saved: true });
      expect((await db.invoice.findUniqueOrThrow({ where: { id: orig.id } })).status).toBe("CANCELLED");
    });

    it("can be linked to a document whose number was recorded by hand", async () => {
      const inv = await save(body({ clientId: a.clientId }));
      await record(inv.invoiceId!, "20600");
      const r = await creditNote(inv.invoiceId!);
      expect(r.creditNoteId).toBeTruthy();
      const draft = await db.invoice.findUniqueOrThrow({ where: { id: r.creditNoteId } });
      expect(draft.docType).toBe(330);
      expect(draft.relatedInvoiceId).toBe(inv.invoiceId);
      expect(draft.morningDocNumber).toBeNull();
      // nothing is cancelled until the credit note's own number is recorded
      expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.invoiceId } })).status).not.toBe("CANCELLED");
      expect(await record(r.creditNoteId!, "20601")).toEqual({ saved: true });
      expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.invoiceId } })).status).toBe("CANCELLED");
    });

    it("won't link a credit that doesn't add up to the original", async () => {
      const orig = await db.invoice.findUniqueOrThrow({ where: { id: a.issuedDocId } });
      const draft = await save(
        credit({
          clientId: orig.clientId,
          relatedInvoiceId: orig.id,
          items: [{ description: "זיכוי חלקי", quantity: 1, unitPrice: "1" }],
        }),
      );
      // A draft may be unfinished; recording its number may not
      expect(draft.invoiceId).toBeTruthy();
      const r = await record(draft.invoiceId!, "302");
      expect(r.error).toBeTruthy();
      expect((await db.invoice.findUniqueOrThrow({ where: { id: orig.id } })).status).not.toBe("CANCELLED");
    });

    it("isn't open to an exempt business", async () => {
      await db.user.update({ where: { id: a.userId }, data: { vatLiable: false } });
      expect((await save(credit())).invoiceId).toBeUndefined();
    });

    it("takes no meetings", async () => {
      const r = await save(credit({ clientId: a.clientId, sessionIds: [a.pastSessionId] }));
      const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId } });
      expect(inv.draftSessionIds).toEqual([]);
    });
  });

  it("keeps the document's settings", async () => {
    const r = await save(body({ lang: "en", vatType: 1, rounding: true }));
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId } });
    expect(inv.lang).toBe("en");
    expect(inv.vatType).toBe(1);
    expect(inv.rounding).toBe(true);
  });

  it("keeps a receipt with several lines and no income lines of its own", async () => {
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
    );
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId }, include: { payments: true } });
    expect(inv.payments).toHaveLength(2);
    expect(Number(inv.total)).toBe(150);
    expect(inv.payments.find((p) => p.method === "BIT")?.reference).toBe("A1");
    expect(await record(r.invoiceId!, "400")).toEqual({ saved: true });
  });

  it("won't record a number while the receipts don't add up to the document", async () => {
    const r = await save(
      body({ kind: "TAX_INVOICE_RECEIPT", payments: [{ method: "CASH", date: "2026-11-02", amount: "1" }] }),
    );
    expect(r.invoiceId).toBeTruthy();
    expect((await record(r.invoiceId!, "500")).error).toContain("סכום התקבולים");
  });

  describe("meetings", () => {
    it("records the number by document type, and keeps a number she typed", async () => {
      await db.session.update({ where: { id: a.pastSessionId }, data: { morningReceiptNumber: "111" } });
      // The form doesn't suggest it now, and the server agrees
      const refused = await save(body({ kind: "TAX_INVOICE", clientId: a.clientId, sessionIds: [a.pastSessionId] }));
      expect(refused.invoiceId).toBeUndefined();

      await db.session.update({ where: { id: a.pastSessionId }, data: { morningReceiptNumber: null } });
      const r = await save(
        body({
          kind: "RECEIPT",
          clientId: a.clientId,
          dueDate: "",
          items: [],
          payments: [{ method: "CASH", date: "2026-11-02", amount: "100" }],
          sessionIds: [a.pastSessionId],
        }),
      );
      expect(await record(r.invoiceId!, "7001")).toEqual({ saved: true });
      const s = await db.session.findUniqueOrThrow({ where: { id: a.pastSessionId } });
      expect(s.morningReceiptNumber).toBe("7001");
      expect(s.morningDocNumber).toBeNull();
    });

    it("a credit note cancelling the document frees its meetings, number and all", async () => {
      const inv = await save(body({ clientId: a.clientId, sessionIds: [a.pastSessionId] }));
      await record(inv.invoiceId!, "7001");
      const issued = await db.session.findUniqueOrThrow({ where: { id: a.pastSessionId } });
      expect(issued.morningDocNumber).toBe("7001");

      const stored = await db.invoice.findUniqueOrThrow({ where: { id: inv.invoiceId } });
      const r = await save(
        body({
          kind: "CREDIT_NOTE",
          clientId: a.clientId,
          dueDate: "",
          relatedInvoiceId: stored.id,
          items: [{ description: "זיכוי", quantity: 1, unitPrice: stored.total.toString() }],
        }),
      );
      expect(await record(r.invoiceId!, "7002")).toEqual({ saved: true });
      const freed = await db.session.findUniqueOrThrow({
        where: { id: a.pastSessionId },
        select: { morningDocNumber: true, invoiceItem: true },
      });
      expect(freed).toEqual({ morningDocNumber: null, invoiceItem: null });
    });
  });

  it("refuses another practice's client or meeting", async () => {
    expect((await save(body({ clientId: b.clientId }))).invoiceId).toBeUndefined();
    const r = await save(body({ clientId: a.clientId, sessionIds: [b.pastSessionId] }));
    expect(r.invoiceId).toBeUndefined();
  });

  it("doesn't take meetings for a one-off client", async () => {
    const r = await save(body({ sessionIds: [a.pastSessionId] }));
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: r.invoiceId } });
    expect(inv.draftSessionIds).toEqual([]);
  });
});
