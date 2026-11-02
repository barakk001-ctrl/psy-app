import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_BYTES, seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

// מסמכי הוצאות on a real Postgres. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "expenses");
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
type Actions = typeof import("@/server/actions/expenses");

const pdf = (name = "הוצאה לדוגמה.pdf") => new File([PDF_BYTES], name, { type: "application/pdf" });
const details = (id: string, intent: string, over: Record<string, string> = {}) =>
  form({
    id,
    intent,
    docType: "305",
    docDate: "2026-10-12",
    supplier: "ספק לדוגמה",
    docNumber: "77",
    amount: "118",
    vatAmount: "18",
    ...over,
  });

describe.skipIf(!TEST_DATABASE_URL)("expense documents (real Postgres)", () => {
  let db: Db;
  let a: Practice;
  let b: Practice;
  let actions: Actions;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("expenses");
    db = (await import("@/lib/db")).db;
    actions = await import("@/server/actions/expenses");
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db as never);
    a = await seedPractice(db as never, "A");
    b = await seedPractice(db as never, "B");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  async function upload(file = pdf()) {
    const r = await actions.uploadExpenseAction(form({ file }));
    if ("error" in r) throw new Error(r.error);
    return r.id;
  }

  it("keeps an upload as a draft, with name and bytes encrypted", async () => {
    const id = await upload();
    const row = await db.expense.findUniqueOrThrow({ where: { id }, include: { blob: true } });
    expect(row.status).toBe("DRAFT");
    expect(row.nameCiphertext).not.toContain("הוצאה");
    expect(Buffer.from(row.blob!.ciphertext).includes(Buffer.from("%PDF"))).toBe(false);
  });

  it("goes by the file's bytes, not its name", async () => {
    const fake = new File([Buffer.from("not really a pdf")], "x.pdf", { type: "application/pdf" });
    expect("error" in (await actions.uploadExpenseAction(form({ file: fake })))).toBe(true);
  });

  it("approves only a complete expense, and a draft may stay unfinished", async () => {
    const id = await upload();
    const refused = await actions.saveExpenseAction(details(id, "approve", { supplier: "" }));
    expect("error" in refused && refused.problems?.[0]).toContain("ספק");
    expect((await db.expense.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");

    expect("ok" in (await actions.saveExpenseAction(details(id, "draft", { supplier: "", amount: "" })))).toBe(true);
    const ok = await actions.saveExpenseAction(details(id, "approve"));
    expect("ok" in ok).toBe(true);
    const row = await db.expense.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("APPROVED");
    expect(Number(row.amount)).toBe(118);
    expect(Number(row.vatAmount)).toBe(18);
  });

  it("moves an approved expense back to draft", async () => {
    const id = await upload();
    await actions.saveExpenseAction(details(id, "approve"));
    await actions.saveExpenseAction(details(id, "draft"));
    expect((await db.expense.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
  });

  it("deletes the expense and its bytes", async () => {
    const id = await upload();
    expect("ok" in (await actions.deleteExpenseAction(form({ id })))).toBe(true);
    expect(await db.expense.count({ where: { id } })).toBe(0);
    expect(await db.expenseBlob.count({ where: { expenseId: id } })).toBe(0);
  });

  it("won't touch another practice's expense", async () => {
    const before = await db.expense.findUniqueOrThrow({ where: { id: b.expenseId } });
    expect("error" in (await actions.saveExpenseAction(details(b.expenseId, "draft", { supplier: "פולש" })))).toBe(true);
    expect("error" in (await actions.deleteExpenseAction(form({ id: b.expenseId })))).toBe(true);
    expect(await db.expense.findUniqueOrThrow({ where: { id: b.expenseId } })).toEqual(before);
  });

  it("refuses everything on an expired account", async () => {
    await db.user.update({
      where: { id: a.userId },
      data: { subscriptionExempt: false, subscriptionPlan: "MONTHLY", subscriptionEndsAt: new Date(Date.now() - 86_400_000), trialEndsAt: new Date(Date.now() - 86_400_000) },
    });
    const id = a.expenseId;
    for (const r of [
      await actions.uploadExpenseAction(form({ file: pdf() })),
      await actions.saveExpenseAction(details(id, "approve")),
      await actions.deleteExpenseAction(form({ id })),
    ]) {
      expect("error" in r).toBe(true);
    }
    expect(await db.expense.count({ where: { id } })).toBe(1);
  });
});
