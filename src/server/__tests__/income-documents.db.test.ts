import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// What documents add to the money the app reports, on a real Postgres. A
// document counts once it is issued. A credit note gives back money that was
// received, once, on its own date, and is never a debt. Skipped unless
// TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "income_documents");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null } };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));

type Db = typeof import("@/lib/db").db;

const OCT = new Date("2026-10-12T00:00:00.000Z");
const NOV = new Date("2026-11-02T00:00:00.000Z");
const FROM = new Date("2026-09-30T00:00:00.000Z");
const OCT_END = new Date("2026-10-31T22:00:00.000Z");
const TO = new Date("2026-12-01T00:00:00.000Z");

describe.skipIf(!TEST_DATABASE_URL)("what documents add to income and debt (real Postgres)", () => {
  let db: Db;
  let data: typeof import("@/lib/income-data");
  let userId: string;
  let clientId: string;
  let otherUserId: string;
  let number = 1;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("income_documents");
    db = (await import("@/lib/db")).db;
    data = await import("@/lib/income-data");
  }, 120_000);

  afterAll(() => {
    mocks.actor.id = null;
  });

  beforeEach(async () => {
    await truncateAll(db as never);
    number = 1;
    const user = await db.user.create({ data: { email: "a@example.test", name: "מטפלת", vatLiable: true } });
    const other = await db.user.create({ data: { email: "b@example.test", name: "אחרת", vatLiable: true } });
    userId = user.id;
    otherUserId = other.id;
    mocks.actor.id = userId;
    const client = await db.client.create({ data: { userId, firstName: "דנה", lastName: "כהן" } });
    clientId = client.id;
  });

  type Doc = {
    docType?: number | null;
    issued?: boolean;
    status?: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
    total?: number;
    paid?: number;
    date?: Date;
    relatedInvoiceId?: string | null;
    currency?: string;
    oneOff?: string;
    method?: "BIT" | "CASH";
    owner?: string;
  };

  /** A document row. `paid` adds a Payment dated like the document. */
  async function doc(d: Doc) {
    const n = number++;
    const issued = d.issued ?? true;
    const total = d.total ?? 350;
    return db.invoice.create({
      data: {
        userId: d.owner ?? userId,
        clientId: d.oneOff ? null : clientId,
        docClientName: d.oneOff ?? null,
        number: n,
        docType: d.docType === undefined ? 305 : d.docType,
        status: d.status ?? "SENT",
        subtotal: total,
        total,
        amountPaid: d.paid ?? 0,
        issueDate: d.date ?? OCT,
        currency: d.currency ?? "ILS",
        relatedInvoiceId: d.relatedInvoiceId ?? null,
        morningDocId: issued ? `m-${n}` : null,
        morningDocNumber: issued ? String(20000 + n) : null,
        ...(d.paid
          ? { payments: { create: { amount: d.paid, method: d.method ?? "BIT", paidAt: d.date ?? OCT } } }
          : {}),
      },
    });
  }

  const received = async (from = FROM, to = TO) => {
    const { entries } = await data.loadIncome(userId, from, to);
    return Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  };
  const debt = async () => {
    const rows = await data.loadOpenDocuments(userId, { currency: "ILS" });
    return rows.reduce((s, r) => s + r.balance, 0);
  };

  describe("issued documents keep their numbers", () => {
    it("a paid invoice-receipt is income and no debt", async () => {
      await doc({ docType: 320, status: "PAID", paid: 350 });
      expect(await received()).toBe(350);
      expect(await debt()).toBe(0);
    });

    it("an unpaid tax invoice is debt and no income", async () => {
      await doc({ docType: 305 });
      expect(await received()).toBe(0);
      expect(await debt()).toBe(350);
    });

    it("a partly paid invoice owes the rest", async () => {
      await doc({ docType: 305, status: "PARTIALLY_PAID", paid: 100 });
      expect(await debt()).toBe(250);
    });

    it("a number typed by hand counts as issued", async () => {
      const inv = await doc({ docType: 320, status: "PAID", paid: 350, issued: false });
      await db.invoice.update({ where: { id: inv.id }, data: { morningDocNumber: "20500" } });
      expect(await received()).toBe(350);
    });

    it("older app invoices are left exactly as they were", async () => {
      await doc({ docType: null, issued: false, status: "DRAFT", total: 200 });
      await doc({ docType: null, issued: false, status: "PARTIALLY_PAID", total: 300, paid: 100 });
      expect(await debt()).toBe(400);
      expect(await received()).toBe(100);
    });
  });

  describe("drafts count as nothing", () => {
    it("a draft tax invoice is no debt", async () => {
      await doc({ docType: 305, issued: false, status: "DRAFT" });
      expect(await debt()).toBe(0);
      expect(await data.loadOpenDocuments(userId, {})).toEqual([]);
    });

    it("a draft with receipt lines is no income, whatever status they gave it", async () => {
      await doc({ docType: 320, issued: false, status: "PAID", paid: 350 });
      await doc({ docType: 400, issued: false, status: "PAID", paid: 200 });
      await doc({ docType: 305, issued: false, status: "PARTIALLY_PAID", paid: 50 });
      expect(await received()).toBe(0);
      expect(await debt()).toBe(0);
      const { entries } = await data.loadIncome(userId, FROM, TO);
      expect(entries).toEqual([]);
    });

    it("a cancelled draft with receipt lines is no income", async () => {
      await doc({ docType: 320, issued: false, status: "CANCELLED", paid: 350 });
      expect(await received()).toBe(0);
    });

    it("a draft receipt doesn't pay off the invoice it's for", async () => {
      const invoice = await doc({ docType: 305, status: "PAID", paid: 0 });
      await db.invoice.update({ where: { id: invoice.id }, data: { amountPaid: 350 } });
      await doc({ docType: 400, issued: false, status: "PAID", paid: 350, relatedInvoiceId: invoice.id });
      expect(await received()).toBe(0);
      expect(await debt()).toBe(350);
    });

    it("once that receipt is issued, the invoice is paid and the money counts", async () => {
      const invoice = await doc({ docType: 305, status: "PAID" });
      await db.invoice.update({ where: { id: invoice.id }, data: { amountPaid: 350 } });
      await doc({ docType: 400, status: "PAID", paid: 350, relatedInvoiceId: invoice.id });
      expect(await received()).toBe(350);
      expect(await debt()).toBe(0);
    });

    it("a partly paid invoice shows only the issued part as paid", async () => {
      const invoice = await doc({ docType: 305, status: "PARTIALLY_PAID", paid: 100 });
      await db.invoice.update({ where: { id: invoice.id }, data: { amountPaid: 150 } });
      await doc({ docType: 400, issued: false, status: "PAID", paid: 50, relatedInvoiceId: invoice.id });
      expect(await debt()).toBe(250);
    });

    it("a meeting marked paid on an old draft line still counts, once, by the meeting", async () => {
      const draft = await doc({ docType: 320, issued: false, status: "PAID", paid: 350 });
      const startsAt = new Date("2026-10-05T08:00:00.000Z");
      const session = await db.session.create({
        data: {
          userId,
          clientId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3_000_000),
          status: "COMPLETED",
          rate: 350,
          paymentStatus: "PAID",
          treatmentType: "טיפול",
        },
      });
      await db.invoiceItem.create({
        data: { invoiceId: draft.id, sessionId: session.id, description: "פגישה", unitPrice: 350, amount: 350 },
      });
      expect(await received()).toBe(350);
    });
  });

  describe("credit notes", () => {
    it("an unlinked credit reduces income on its own date and is no debt", async () => {
      await doc({ docType: 320, status: "PAID", paid: 500 });
      await doc({ docType: 330, total: 200, date: NOV });
      expect(await received()).toBe(300);
      expect(await received(FROM, OCT_END)).toBe(500);
      expect(await debt()).toBe(0);
      expect(await data.loadOpenDocuments(userId, {})).toEqual([]);
    });

    it("cancelling a paid document in full comes to zero, once", async () => {
      const orig = await doc({ docType: 320, status: "CANCELLED", paid: 350 });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received()).toBe(0);
      expect(await debt()).toBe(0);
    });

    it("keeps the month it was paid, and gives it back in the month of the credit", async () => {
      const orig = await doc({ docType: 320, status: "CANCELLED", paid: 350 });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received(FROM, OCT_END)).toBe(350);
      expect(await received(OCT_END, TO)).toBe(-350);
    });

    it("cancelling an unpaid invoice gives nothing back: there was nothing received", async () => {
      await doc({ docType: 320, status: "PAID", paid: 900 });
      const orig = await doc({ docType: 305, status: "CANCELLED" });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received()).toBe(900);
      expect(await debt()).toBe(0);
    });

    it("cancelling a tax invoice paid by its receipt gives back the receipt's money", async () => {
      const orig = await doc({ docType: 305, status: "CANCELLED" });
      await db.invoice.update({ where: { id: orig.id }, data: { amountPaid: 350 } });
      await doc({ docType: 400, status: "PAID", paid: 350, relatedInvoiceId: orig.id });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received()).toBe(0);
    });

    it("gives back only what was received on a partly paid invoice", async () => {
      const orig = await doc({ docType: 305, status: "CANCELLED", paid: 100 });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received()).toBe(0);
    });

    it("a draft receipt on the original isn't money to give back", async () => {
      const orig = await doc({ docType: 305, status: "CANCELLED" });
      await db.invoice.update({ where: { id: orig.id }, data: { amountPaid: 350 } });
      await doc({ docType: 400, issued: false, status: "PAID", paid: 350, relatedInvoiceId: orig.id });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      expect(await received()).toBe(0);
    });

    it("a draft or cancelled credit counts as nothing", async () => {
      await doc({ docType: 320, status: "PAID", paid: 500 });
      await doc({ docType: 330, issued: false, status: "DRAFT", total: 200 });
      await doc({ docType: 330, status: "CANCELLED", total: 100 });
      expect(await received()).toBe(500);
      expect(await debt()).toBe(0);
    });

    it("a meeting the credit freed but that's still marked paid counts once, by the meeting", async () => {
      const orig = await doc({ docType: 320, status: "CANCELLED", paid: 350 });
      await doc({ docType: 330, date: NOV, relatedInvoiceId: orig.id });
      const startsAt = new Date("2026-10-05T08:00:00.000Z");
      await db.session.create({
        data: {
          userId,
          clientId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3_000_000),
          status: "COMPLETED",
          rate: 350,
          paymentStatus: "PAID",
          treatmentType: "טיפול",
        },
      });
      expect(await received()).toBe(350);
    });

    it("a credit in another currency isn't taken off shekel income", async () => {
      await doc({ docType: 320, status: "PAID", paid: 500 });
      await doc({ docType: 330, total: 100, currency: "USD" });
      expect(await received()).toBe(500);
    });

    it("shows in the breakdowns as a credit, for the right client", async () => {
      await doc({ docType: 320, status: "PAID", paid: 500 });
      await doc({ docType: 330, total: 200, date: NOV });
      await doc({ docType: 330, total: 50, date: NOV, oneOff: "אורח" });
      const { payments, sessions, entries } = await data.loadIncome(userId, FROM, TO);
      const { incomeByClient, incomeByMethod, clientBreakdown } = await import("@/lib/income");
      expect(incomeByMethod(entries).find((m) => m.key === "CREDIT_NOTE")?.total).toBe(-250);
      expect(incomeByClient(entries).find((c) => c.label === "דנה כהן")?.total).toBe(300);
      expect(incomeByClient(entries).find((c) => c.label === "אורח")?.total).toBe(-50);
      const rows = clientBreakdown(sessions, entries);
      expect(rows.reduce((s, r) => s + r.received, 0)).toBe(250);
      expect(payments).toHaveLength(3);
    });
  });

  describe("every surface agrees", () => {
    it("the reports page's total and open debt", async () => {
      await doc({ docType: 305 });
      await doc({ docType: 305, issued: false, status: "DRAFT" });
      await doc({ docType: 320, status: "PAID", paid: 500, date: NOV });
      await doc({ docType: 320, issued: false, status: "PAID", paid: 111, date: NOV });
      await doc({ docType: 330, total: 200, date: NOV });
      const { loadReportData } = await import("@/lib/reports");
      const r = await loadReportData(userId, "this-year", new Date("2026-11-15T10:00:00.000Z"));
      expect(r.summary.received).toBe(300);
      expect(r.outstanding).toBe(350);
      expect(r.outstandingInvoices).toHaveLength(1);
      expect(r.twelveMonths.reduce((s, m) => s + m.value, 0)).toBe(300);
    });

    it("the income PDF renders with a credit in it", async () => {
      await doc({ docType: 320, status: "PAID", paid: 500 });
      await doc({ docType: 330, total: 200, date: NOV });
      const { GET } = await import("@/app/api/reports/income/route");
      const res = await GET(new Request("http://test.local/api/reports/income?from=2026-10-01&to=2026-11-30"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("pdf");
    }, 60_000);

    it("stays inside the practice", async () => {
      await doc({ docType: 305, owner: otherUserId });
      await doc({ docType: 330, total: 100, owner: otherUserId });
      expect(await debt()).toBe(0);
      expect(await received()).toBe(0);
    });

    it("the client filter narrows open documents", async () => {
      await doc({ docType: 305 });
      const rows = await data.loadOpenDocuments(userId, { clientId: "someone-else" });
      expect(rows).toEqual([]);
    });
  });
});
