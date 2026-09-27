import { describe, expect, it } from "vitest";
import {
  clientBreakdown,
  clinicMonthKey,
  clinicMonthRange,
  expectedIncome,
  incomeByClient,
  incomeEntries,
  lastMonths,
  monthlyTotals,
  sessionPaymentAmount,
  tookPlace,
  type RawInvoicePayment,
  type RawSession,
} from "@/lib/income";
import {
  getPeriodRange,
  parseDateRange,
  periodDates,
  rangeLabel,
  summarizeIncome,
} from "@/lib/report-periods";

function session(over: Partial<Omit<RawSession, "startsAt">> & { startsAt: string }): RawSession {
  return {
    id: Math.random().toString(36).slice(2),
    clientId: "c1",
    clientName: "דנה כהן",
    status: "SCHEDULED",
    rate: 400,
    paymentStatus: null,
    paymentMethod: null,
    paidAmount: null,
    hasInvoice: false,
    ...over,
    startsAt: new Date(over.startsAt),
  };
}

const payment = (over: Partial<RawInvoicePayment> = {}): RawInvoicePayment => ({
  amount: 300,
  paidAt: new Date("2026-09-10T09:00:00Z"),
  method: "BIT",
  clientId: "c2",
  clientName: "יוסי לוי",
  ...over,
});

describe("sessionPaymentAmount", () => {
  it("counts a meeting marked paid, at the typed amount", () => {
    expect(sessionPaymentAmount({ paymentStatus: "PAID", paidAmount: 350, rate: 400, hasInvoice: false })).toBe(350);
  });
  it("falls back to the rate when paid with no amount typed", () => {
    expect(sessionPaymentAmount({ paymentStatus: "PAID", paidAmount: null, rate: 400, hasInvoice: false })).toBe(400);
  });
  it("ignores unpaid / exempt meetings and ones billed through an app invoice", () => {
    expect(sessionPaymentAmount({ paymentStatus: "UNPAID", paidAmount: null, rate: 400, hasInvoice: false })).toBe(0);
    expect(sessionPaymentAmount({ paymentStatus: "EXEMPT", paidAmount: null, rate: 400, hasInvoice: false })).toBe(0);
    expect(sessionPaymentAmount({ paymentStatus: "PAID", paidAmount: 400, rate: 400, hasInvoice: true })).toBe(0);
  });
});

describe("summarizeIncome — the reports page's numbers", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("counts per-meeting payments, not only app-invoice payments (the ₪0.00 bug)", () => {
    // Keren's workflow: billing in Morning, meetings marked paid in the app,
    // no app invoices at all. Reports used to read only Payment rows → ₪0.
    const sessions = [
      session({ startsAt: "2026-09-01T07:00:00Z", status: "COMPLETED", paymentStatus: "PAID", paidAmount: 400, paymentMethod: "BIT" }),
      session({ startsAt: "2026-09-08T07:00:00Z", paymentStatus: "PAID", paidAmount: 400, paymentMethod: "BANK_TRANSFER" }),
      session({ startsAt: "2026-09-15T07:00:00Z", paymentStatus: "UNPAID" }),
      session({ startsAt: "2026-09-22T07:00:00Z", status: "CANCELLED" }),
      session({ startsAt: "2026-09-29T07:00:00Z" }), // still ahead
    ];
    const s = summarizeIncome([], sessions, now);
    expect(s.received).toBe(800);
    expect(s.receivedFromSessions).toBe(800);
    expect(s.expected).toBe(1600); // 4 booked/held meetings × 400, cancelled excluded
    expect(s.sessionsHeld).toBe(3); // past & not cancelled, marked or not
    expect(s.sessionsCancelled).toBe(1);
    expect(s.byMethod.map((m) => [m.label, m.total])).toEqual([
      ["ביט", 400],
      ["העברה בנקאית", 400],
    ]);
  });

  it("adds app-invoice payments without double-counting their meetings", () => {
    const sessions = [
      // Billed through an app invoice → its money arrives as a Payment row
      session({ startsAt: "2026-09-03T07:00:00Z", paymentStatus: "PAID", paidAmount: 300, hasInvoice: true }),
      session({ startsAt: "2026-09-04T07:00:00Z", clientId: "c1", paymentStatus: "PAID", paidAmount: 400 }),
    ];
    const s = summarizeIncome([payment({ amount: 300 })], sessions, now);
    expect(s.received).toBe(700);
    expect(s.receivedFromInvoices).toBe(300);
    expect(s.receivedFromSessions).toBe(400);
    expect(s.byClient.map((c) => [c.label, c.total, c.count])).toEqual([
      ["דנה כהן", 400, 1],
      ["יוסי לוי", 300, 1],
    ]);
  });

  it("matches the dashboard's month income for the same rows", () => {
    // The dashboard sums invoice payments + paid meetings without an invoice
    const payments = [payment({ amount: 150.5 }), payment({ amount: 49.5 })];
    const sessions = [session({ startsAt: "2026-09-02T07:00:00Z", paymentStatus: "PAID", paidAmount: 5150 })];
    expect(summarizeIncome(payments, sessions, now).received).toBe(5350);
  });
});

describe("clinic-calendar periods", () => {
  it("starts months at midnight Israel time, not UTC", () => {
    const [from, to] = clinicMonthRange(2026, 10);
    expect(from.toISOString()).toBe("2026-09-30T21:00:00.000Z"); // IDT, UTC+3
    expect(to.toISOString()).toBe("2026-10-31T22:00:00.000Z"); // IST after DST ends
  });

  it("puts a late-evening meeting in the local month", () => {
    // 30 Sep 23:30 UTC is already 1 Oct 02:30 in Israel
    expect(clinicMonthKey(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10");
    expect(clinicMonthKey(new Date("2026-09-30T20:30:00Z"))).toBe("2026-09");
  });

  it("builds this month / last month / quarter / year ranges", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(getPeriodRange("this-month", now)[0].toISOString()).toBe("2025-12-31T22:00:00.000Z");
    expect(getPeriodRange("last-month", now)[0].toISOString()).toBe("2025-11-30T22:00:00.000Z");
    expect(getPeriodRange("this-quarter", now)[1].toISOString()).toBe("2026-03-31T21:00:00.000Z");
    expect(getPeriodRange("last-year", now)[0].toISOString()).toBe("2024-12-31T22:00:00.000Z");
    expect(periodDates("last-month", now)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodDates("this-quarter", now)).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });

  it("lists the last 12 months oldest first and buckets income into them", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const months = lastMonths(12, now);
    expect(months.map((m) => m.key)[0]).toBe("2025-10");
    expect(months.map((m) => m.key)[11]).toBe("2026-09");
    const totals = monthlyTotals(
      incomeEntries(
        [payment({ amount: 100, paidAt: new Date("2026-08-31T22:30:00Z") })], // 1 Sep local
        [session({ startsAt: "2025-10-05T07:00:00Z", paymentStatus: "PAID", paidAmount: 250 })],
      ),
      months,
    );
    expect(totals[0]).toBe(250);
    expect(totals[10]).toBe(0);
    expect(totals[11]).toBe(100);
  });
});

describe("export ranges", () => {
  it("accepts a valid range and covers whole days", () => {
    const r = parseDateRange("2026-09-01", "2026-09-30");
    expect(r?.range[0].toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(r?.range[1].toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });
  it("rejects reversed, malformed or impossible dates", () => {
    expect(parseDateRange("2026-09-30", "2026-09-01")).toBeNull();
    expect(parseDateRange("2026-9-1", "2026-09-30")).toBeNull();
    expect(parseDateRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(parseDateRange(null, "2026-03-01")).toBeNull();
  });
  it("labels a whole month by name and anything else by dates", () => {
    expect(rangeLabel("2026-09-01", "2026-09-30")).toBe("ספטמבר 2026");
    expect(rangeLabel("2026-09-01", "2026-09-15")).toBe("1.9.2026 עד 15.9.2026");
  });
});

describe("expectedIncome / tookPlace / incomeByClient", () => {
  it("expects only booked or held meetings", () => {
    expect(
      expectedIncome([
        { status: "SCHEDULED", rate: 400 },
        { status: "COMPLETED", rate: 350 },
        { status: "CANCELLED", rate: 400 },
        { status: "NO_SHOW", rate: 400 },
        { status: "SCHEDULED", rate: null },
      ]),
    ).toBe(750);
  });
  it("treats past unmarked meetings as held", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(tookPlace({ status: "SCHEDULED", startsAt: new Date("2026-09-27T07:00:00Z") }, now)).toBe(true);
    expect(tookPlace({ status: "SCHEDULED", startsAt: new Date("2026-09-29T07:00:00Z") }, now)).toBe(false);
    expect(tookPlace({ status: "NO_SHOW", startsAt: new Date("2026-09-27T07:00:00Z") }, now)).toBe(false);
  });
  it("sorts clients by total with percentages", () => {
    const shares = incomeByClient(
      incomeEntries([payment({ amount: 100 }), payment({ amount: 300, clientId: "c3", clientName: "ג" })], []),
    );
    expect(shares[0].label).toBe("ג");
    expect(Math.round(shares[0].pct)).toBe(75);
  });
});

describe("clientBreakdown", () => {
  it("lists each client's held meetings, expected and received", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const sessions = [
      session({ startsAt: "2026-09-01T07:00:00Z", paymentStatus: "PAID", paidAmount: 400 }),
      session({ startsAt: "2026-09-08T07:00:00Z" }),
      session({ startsAt: "2026-09-15T07:00:00Z", status: "CANCELLED" }),
      session({ startsAt: "2026-09-03T07:00:00Z", clientId: "c2", clientName: "יוסי לוי", rate: 300, hasInvoice: true }),
    ];
    const rows = clientBreakdown(sessions, incomeEntries([payment({ amount: 300 })], sessions), now);
    expect(rows).toEqual([
      { clientId: "c1", name: "דנה כהן", held: 2, expected: 800, received: 400 },
      { clientId: "c2", name: "יוסי לוי", held: 1, expected: 300, received: 300 },
    ]);
  });
});
