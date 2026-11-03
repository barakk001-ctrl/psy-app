import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// Filters and periods that update in place must show what a full page load
// shows, on a real Postgres. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "income_doc_list");
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

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const daysAgo = (n: number) => new Date(new Date(`${today()}T00:00:00.000Z`).getTime() - n * 86_400_000);

describe.skipIf(!TEST_DATABASE_URL)("what the in-place filters show (real Postgres)", () => {
  let db: Db;
  let userId: string;
  let otherId: string;
  let clientId: string;
  let number = 1;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("income_doc_list");
    db = (await import("@/lib/db")).db;
  }, 120_000);

  afterAll(() => {
    mocks.actor.id = null;
  });

  beforeEach(async () => {
    await truncateAll(db as never);
    number = 1;
    userId = (await db.user.create({ data: { email: "a@example.test", name: "א", vatLiable: true } })).id;
    otherId = (await db.user.create({ data: { email: "b@example.test", name: "ב", vatLiable: true } })).id;
    clientId = (await db.client.create({ data: { userId, firstName: "דנה", lastName: "כהן" } })).id;
    mocks.actor.id = userId;
  });

  async function doc(o: {
    docType?: number | null;
    status?: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
    ago?: number;
    issued?: boolean;
    total?: number;
    paid?: number;
    owner?: string;
  }) {
    const n = number++;
    const issued = o.issued ?? true;
    const total = o.total ?? 350;
    const owner = o.owner ?? userId;
    return db.invoice.create({
      data: {
        userId: owner,
        clientId: owner === userId ? clientId : null,
        docClientName: owner === userId ? null : "אורח",
        number: n,
        docType: o.docType === undefined ? 305 : o.docType,
        status: o.status ?? "SENT",
        subtotal: total,
        total,
        amountPaid: o.paid ?? 0,
        issueDate: daysAgo(o.ago ?? 2),
        morningDocId: issued ? `m-${n}` : null,
        morningDocNumber: issued ? String(20000 + n) : null,
      },
    });
  }

  /** The seeded documents' names by filter, through the route. */
  const route = async (query: string) => {
    const { GET } = await import("@/app/api/invoices/documents/route");
    return GET(new Request(`http://test.local/api/invoices/documents${query}`));
  };
  const idsFrom = async (query: string) => {
    const res = await route(query);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { months: { rows: { id: string }[] }[] };
    return data.months.flatMap((m) => m.rows.map((r) => r.id));
  };
  /** What the page's own query gave before this moved in place. */
  const pageQuery = async (query: string) => {
    const { docListWhere, parseDocListFilters } = await import("@/lib/income-doc-list");
    const filters = parseDocListFilters(Object.fromEntries(new URLSearchParams(query)));
    const rows = await db.invoice.findMany({
      where: docListWhere(userId, { ...filters, view: "documents" }, today()),
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      take: 500,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  };

  it("matches the page's query for every filter choice", async () => {
    await doc({ ago: 2 });
    await doc({ ago: 2, docType: 320, status: "PAID", paid: 350 });
    await doc({ ago: 40, docType: 400, status: "PAID", paid: 350 });
    await doc({ ago: 40, docType: 330 });
    await doc({ ago: 200, status: "PARTIALLY_PAID", paid: 100 });
    await doc({ ago: 200, status: "CANCELLED" });
    await doc({ ago: 500, docType: 320, status: "PAID", paid: 350 });
    await doc({ ago: 3, docType: null, issued: false, status: "SENT" });
    await doc({ ago: 3, issued: false, status: "DRAFT" });

    const periods = ["", "period=month", "period=12m", "period=all", `period=custom&from=${daysAgo(50).toISOString().slice(0, 10)}&to=${daysAgo(1).toISOString().slice(0, 10)}`, "period=custom"];
    const types = ["", "type=305", "type=320", "type=400", "type=330"];
    const statuses = ["", "status=open", "status=paid", "status=cancelled"];
    let checked = 0;
    for (const p of periods) {
      for (const t of types) {
        for (const s of statuses) {
          const q = [p, t, s].filter(Boolean).join("&");
          const query = q ? `?${q}` : "";
          expect(await idsFrom(query), query).toEqual(await pageQuery(q));
          checked++;
        }
      }
    }
    expect(checked).toBe(120);
  }, 60_000);

  it("filters as expected on known rows", async () => {
    const recent = await doc({ ago: 2 });
    const paid = await doc({ ago: 2, docType: 320, status: "PAID", paid: 350 });
    const old = await doc({ ago: 90 });
    const older = await doc({ ago: 500 });
    await doc({ ago: 1, issued: false, status: "DRAFT" }); // a draft is never here

    expect((await idsFrom("")).sort()).toEqual([recent.id, paid.id, old.id].sort());
    expect((await idsFrom("?period=month")).sort()).toEqual([recent.id, paid.id].sort());
    expect((await idsFrom("?period=all")).length).toBe(4);
    expect(await idsFrom("?period=all&type=320")).toEqual([paid.id]);
    expect((await idsFrom("?period=all&status=open")).sort()).toEqual([recent.id, old.id, older.id].sort());
    expect(await idsFrom("?type=330")).toEqual([]);
  });

  it("gives display rows, with a credit note reading as going back", async () => {
    await doc({ ago: 2, docType: 330, total: 200 });
    await doc({ ago: 2, status: "PARTIALLY_PAID", total: 300, paid: 100 });
    const res = await route("");
    const data = (await res.json()) as {
      capped: boolean;
      months: { key: string; label: string; rows: { amount: string; balance: string | null; credit: boolean }[] }[];
    };
    expect(data.capped).toBe(false);
    expect(data.months).toHaveLength(1);
    const rows = data.months[0].rows;
    expect(rows.find((r) => r.credit)?.amount.startsWith("−")).toBe(true);
    expect(rows.find((r) => !r.credit)?.balance).toContain("200");
  });

  it("answers a guest with 401 and stays inside the practice", async () => {
    const mine = await doc({ ago: 2 });
    await doc({ ago: 2, owner: otherId });
    expect(await idsFrom("")).toEqual([mine.id]);
    mocks.actor.id = null;
    expect((await route("")).status).toBe(401);
  });

  it("isn't thrown by nonsense in the address", async () => {
    await doc({ ago: 2 });
    expect(await idsFrom("?period=x&type=999&status=y&from=1'%3B")).toHaveLength(1);
  });

  describe("report periods", () => {
    async function seedMoney() {
      await doc({ ago: 2, docType: 330, total: 50 });
      for (const ago of [2, 45, 100, 200, 300, 400, 500, 650]) {
        const inv = await doc({ ago, docType: 320, status: "PAID", total: 100 + ago, paid: 100 + ago });
        await db.payment.create({
          data: { invoiceId: inv.id, amount: 100 + ago, method: "BIT", paidAt: daysAgo(ago) },
        });
        const startsAt = new Date(daysAgo(ago).getTime() + 8 * 3_600_000);
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
      }
    }

    it("each period is exactly what loading it alone gives", async () => {
      await seedMoney();
      const { loadAllPeriodsReport, PERIODS, getPeriodRange } = await import("@/lib/reports");
      const { loadInvoicePayments, loadSessions } = await import("@/lib/income-data");
      const { summarizeIncome } = await import("@/lib/report-periods");
      const now = new Date();
      const all = await loadAllPeriodsReport(userId, now);
      for (const p of PERIODS) {
        const [from, to] = getPeriodRange(p.key, now);
        const alone = summarizeIncome(
          await loadInvoicePayments(userId, from, to),
          await loadSessions(userId, from, to),
          now,
        );
        expect(all.periods[p.key], p.key).toEqual(alone);
      }
    });

    it("the 12-month chart matches a load of just those months", async () => {
      await seedMoney();
      const { loadAllPeriodsReport } = await import("@/lib/reports");
      const { loadInvoicePayments, loadSessions } = await import("@/lib/income-data");
      const { clinicMonthRange, expectedIncome, incomeEntries, lastMonths, monthlyTotals } = await import("@/lib/income");
      const now = new Date();
      const months = lastMonths(12, now);
      const [from] = clinicMonthRange(months[0].year, months[0].month);
      const [, to] = clinicMonthRange(months[11].year, months[11].month);
      const payments = await loadInvoicePayments(userId, from, to);
      const sessions = await loadSessions(userId, from, to);
      const all = await loadAllPeriodsReport(userId, now);
      expect(all.twelveMonths.map((m) => m.value)).toEqual(monthlyTotals(incomeEntries(payments, sessions), months));
      expect(all.twelveMonths.map((m) => m.expected)).toEqual(
        months.map((mo) => {
          const [a, b] = clinicMonthRange(mo.year, mo.month);
          return expectedIncome(sessions.filter((s) => s.startsAt >= a && s.startsAt < b));
        }),
      );
    });
  });
});
