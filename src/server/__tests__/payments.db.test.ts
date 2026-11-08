import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

// Payments recorded one by one on the older-invoice page, and "סימון כנשלחה",
// on a real Postgres (accounting PR 1.2): only an older app invoice nothing
// was issued for changes this way, and the sums are exact (agorot, no floats).
// Made-up practices only. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "payments");
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
type Payments = typeof import("@/server/actions/payments");
type Invoices = typeof import("@/server/actions/invoices");

describe.skipIf(!TEST_DATABASE_URL)("older-invoice payments (real Postgres)", () => {
  let db: Db;
  let a: Practice;
  let payments: Payments;
  let invoices: Invoices;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("payments");
    db = (await import("@/lib/db")).db;
    payments = await import("@/server/actions/payments");
    invoices = await import("@/server/actions/invoices");
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db as never);
    a = await seedPractice(db as never, "A");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  const pay = (invoiceId: string, amount: string) =>
    payments.recordPaymentAction(null, form({ invoiceId, amount, method: "CASH", paidAt: "2026-11-05" }));

  /** An older app invoice (no type, nothing issued) of `total` shekels. */
  async function olderInvoice(total: string, number: number, status: "DRAFT" | "SENT" = "SENT") {
    return db.invoice.create({
      data: { userId: a.userId, clientId: a.clientId, number, status, subtotal: total, total },
    });
  }

  /** Everything about an invoice that a refused action must leave alone. */
  async function snapshot(id: string) {
    const inv = await db.invoice.findUniqueOrThrow({
      where: { id },
      include: { payments: { orderBy: { id: "asc" } } },
    });
    return JSON.stringify(inv);
  }

  it("sums 0.10 + 0.20 exactly and marks the invoice paid", async () => {
    const inv = await olderInvoice("0.30", 50);
    expect(await pay(inv.id, "0.10")).toEqual({ saved: true });
    expect(await pay(inv.id, "0.20")).toEqual({ saved: true });
    const after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.amountPaid.toFixed(2)).toBe("0.30");
    expect(after.status).toBe("PAID");
    // Nothing left to pay: one agora more is refused
    expect((await pay(inv.id, "0.01"))?.fieldErrors?.amount).toBeTruthy();
  });

  it("keeps the older behaviour: a partial payment, then deleting it", async () => {
    const inv = await olderInvoice("400.00", 51);
    expect(await pay(inv.id, "150.55")).toEqual({ saved: true });
    let after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { payments: true } });
    expect(after.amountPaid.toFixed(2)).toBe("150.55");
    expect(after.status).toBe("PARTIALLY_PAID");
    await payments.deletePaymentAction(form({ id: after.payments[0].id }));
    after = await db.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { payments: true } });
    expect(after.payments).toEqual([]);
    expect(after.amountPaid.toFixed(2)).toBe("0.00");
    expect(after.status).toBe("SENT");
  });

  it("refuses an amount with more than two decimals", async () => {
    const inv = await olderInvoice("100.00", 52);
    const before = await snapshot(inv.id);
    expect((await pay(inv.id, "10.005"))?.fieldErrors?.amount).toBeTruthy();
    expect(await snapshot(inv.id)).toBe(before);
  });

  it("refuses a payment on a numbered document and changes nothing", async () => {
    const before = await snapshot(a.issuedDocId);
    expect((await pay(a.issuedDocId, "50"))?.error).toContain("כבר הופק");
    expect(await snapshot(a.issuedDocId)).toBe(before);
  });

  it("refuses a payment on a draft document (its receipt lines live in the draft)", async () => {
    const before = await snapshot(a.draftDocId);
    expect((await pay(a.draftDocId, "50"))?.error).toContain("בעריכת הטיוטה");
    expect(await snapshot(a.draftDocId)).toBe(before);
  });

  it("refuses an older invoice that morning issued a receipt for", async () => {
    const inv = await olderInvoice("200.00", 53);
    await db.invoice.update({ where: { id: inv.id }, data: { morningDocId: "gi-receipt-1" } });
    const before = await snapshot(inv.id);
    expect((await pay(inv.id, "50"))?.error).toContain("כבר הופק");
    expect(await snapshot(inv.id)).toBe(before);
  });

  it("refuses deleting a payment of a numbered document and changes nothing", async () => {
    const p = await db.payment.create({
      data: { invoiceId: a.issuedDocId, amount: "200.00", method: "BANK_TRANSFER" },
    });
    await db.invoice.update({ where: { id: a.issuedDocId }, data: { amountPaid: "200.00", status: "PAID" } });
    const before = await snapshot(a.issuedDocId);
    await payments.deletePaymentAction(form({ id: p.id }));
    expect(await snapshot(a.issuedDocId)).toBe(before);
  });

  it("refuses deleting a payment of a document draft", async () => {
    const p = await db.payment.create({ data: { invoiceId: a.draftDocId, amount: "300.00", method: "CASH" } });
    const before = await snapshot(a.draftDocId);
    await payments.deletePaymentAction(form({ id: p.id }));
    expect(await snapshot(a.draftDocId)).toBe(before);
  });

  it("marks only an older invoice as sent", async () => {
    const older = await olderInvoice("100.00", 54, "DRAFT");
    await invoices.markInvoiceSentAction(form({ id: older.id }));
    expect((await db.invoice.findUniqueOrThrow({ where: { id: older.id } })).status).toBe("SENT");

    for (const id of [a.issuedDocId, a.draftDocId]) {
      const before = await snapshot(id);
      await invoices.markInvoiceSentAction(form({ id }));
      expect(await snapshot(id)).toBe(before);
    }
  });
});
