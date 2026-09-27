// Income rules shared by the dashboard, the reports page and the income PDF,
// so every surface shows the same numbers.
//
// Money comes in two ways (see CLAUDE.md, "Billing: two parallel workflows"):
//   1. Payments recorded on an app invoice (Payment rows, dated by paidAt)
//   2. The quick per-meeting payment record of the Morning-first workflow
//      (Session.paymentStatus = PAID + paidAmount, dated by the meeting)
// A meeting billed through an app invoice is counted only through (1), so
// nothing is counted twice.
//
// Month/period boundaries follow the clinic's wall clock (Asia/Jerusalem) —
// the server runs in UTC, so `new Date(y, m, 1)` would be 2–3 hours off.

import { fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";

export type RawInvoicePayment = {
  amount: number;
  paidAt: Date;
  method: string;
  clientId: string;
  clientName: string;
};

export type RawSession = {
  id: string;
  clientId: string;
  clientName: string;
  startsAt: Date;
  status: string; // SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
  rate: number | null;
  paymentStatus: string | null; // PAID | UNPAID | EXEMPT | null
  paymentMethod: string | null;
  paidAmount: number | null;
  hasInvoice: boolean;
};

export type IncomeEntry = {
  date: Date;
  amount: number;
  method: string | null;
  clientId: string;
  clientName: string;
  source: "invoice" | "session";
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "מזומן",
  BIT: "ביט",
  CHECK: "המחאה",
  BANK_TRANSFER: "העברה בנקאית",
  CREDIT_CARD: "כרטיס אשראי",
  PAYPAL: "PayPal",
  OTHER: "אחר",
};

/** What a meeting's quick payment record adds to income. A meeting marked
 *  "שולם" with no amount typed counts at its rate. */
export function sessionPaymentAmount(
  s: Pick<RawSession, "paymentStatus" | "paidAmount" | "rate" | "hasInvoice">,
): number {
  if (s.hasInvoice || s.paymentStatus !== "PAID") return 0;
  return s.paidAmount ?? s.rate ?? 0;
}

/** Every shekel received, from both workflows. */
export function incomeEntries(
  payments: RawInvoicePayment[],
  sessions: RawSession[],
): IncomeEntry[] {
  const out: IncomeEntry[] = payments.map((p) => ({
    date: p.paidAt,
    amount: p.amount,
    method: p.method,
    clientId: p.clientId,
    clientName: p.clientName,
    source: "invoice",
  }));
  for (const s of sessions) {
    const amount = sessionPaymentAmount(s);
    if (amount > 0) {
      out.push({
        date: s.startsAt,
        amount,
        method: s.paymentMethod,
        clientId: s.clientId,
        clientName: s.clientName,
        source: "session",
      });
    }
  }
  return out;
}

export function sumAmounts(entries: { amount: number }[]): number {
  // Round to agorot so float noise never shows up as ₪0.01 differences
  return Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

/** Expected income: the rates of the period's meetings that are booked or
 *  took place (cancelled / no-show meetings earn nothing). */
export function expectedIncome(sessions: Pick<RawSession, "status" | "rate">[]): number {
  return sumAmounts(
    sessions
      .filter((s) => s.status === "SCHEDULED" || s.status === "COMPLETED")
      .map((s) => ({ amount: s.rate ?? 0 })),
  );
}

/** A meeting took place if it was marked so, or if it was booked and its time
 *  has passed without being cancelled (most meetings are never marked). */
export function tookPlace(
  s: Pick<RawSession, "status" | "startsAt">,
  now: Date = new Date(),
): boolean {
  if (s.status === "COMPLETED") return true;
  return s.status === "SCHEDULED" && s.startsAt.getTime() <= now.getTime();
}

// ── Clinic-calendar dates ────────────────────────────────────────────────

function ymd(y: number, m: number, d: number): string {
  // Date.UTC normalises overflow (month 13 → next year, day 0 → last day)
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** Start of a clinic-calendar day ("yyyy-mm-dd") as a UTC instant. */
export function clinicDayStart(dateStr: string): Date {
  return fromZonedDateTimeLocal(`${dateStr}T00:00`);
}

/** "yyyy-mm" of an instant, by the clinic wall clock. */
export function clinicMonthKey(d: Date): string {
  return toZonedDateTimeLocal(d).slice(0, 7);
}

/** Today's clinic-calendar year/month/day. */
export function clinicToday(now: Date = new Date()): { y: number; m: number; d: number } {
  const [y, m, d] = toZonedDateTimeLocal(now).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** [start, endExclusive) of a clinic-calendar month (month is 1–12 and may
 *  overflow either way, e.g. 0 = December of the year before). */
export function clinicMonthRange(year: number, month: number): [Date, Date] {
  return [clinicDayStart(ymd(year, month, 1)), clinicDayStart(ymd(year, month + 1, 1))];
}

/** [start, endExclusive) covering whole clinic days from..to (inclusive). */
export function clinicDateRange(from: string, to: string): [Date, Date] {
  const [y, m, d] = to.split("-").map(Number);
  return [clinicDayStart(from), clinicDayStart(ymd(y, m, d + 1))];
}

export type MonthBucket = { key: string; year: number; month: number; label: string };

/** The last `count` clinic-calendar months, oldest first, ending this month. */
export function lastMonths(count: number, now: Date = new Date()): MonthBucket[] {
  const { y, m } = clinicToday(now);
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = ymd(y, m - i, 1).slice(0, 7);
    const [yy, mm] = key.split("-").map(Number);
    out.push({
      key,
      year: yy,
      month: mm,
      label: new Intl.DateTimeFormat("he-IL", { month: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(yy, mm - 1, 15)),
      ),
    });
  }
  return out;
}

/** Sums entries into the given months (entries outside them are ignored). */
export function monthlyTotals(
  entries: { date: Date; amount: number }[],
  months: MonthBucket[],
): number[] {
  const totals = new Map(months.map((mo) => [mo.key, 0]));
  for (const e of entries) {
    const key = clinicMonthKey(e.date);
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + e.amount);
  }
  return months.map((mo) => Math.round((totals.get(mo.key) ?? 0) * 100) / 100);
}

export type Share = { key: string; label: string; total: number; count: number; pct: number };

function toShares(map: Map<string, { label: string; total: number; count: number }>): Share[] {
  const all = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
      pct: all > 0 ? (v.total / all) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function incomeByClient(entries: IncomeEntry[]): Share[] {
  const map = new Map<string, { label: string; total: number; count: number }>();
  for (const e of entries) {
    const cur = map.get(e.clientId) ?? { label: e.clientName, total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(e.clientId, cur);
  }
  return toShares(map);
}

export function incomeByMethod(entries: IncomeEntry[]): Share[] {
  const map = new Map<string, { label: string; total: number; count: number }>();
  for (const e of entries) {
    const key = e.method ?? "UNKNOWN";
    const cur = map.get(key) ?? {
      label: e.method ? (PAYMENT_METHOD_LABELS[e.method] ?? e.method) : "לא צוין",
      total: 0,
      count: 0,
    };
    cur.total += e.amount;
    cur.count += 1;
    map.set(key, cur);
  }
  return toShares(map);
}

export type ClientRow = {
  clientId: string;
  name: string;
  held: number; // meetings that took place
  expected: number;
  received: number;
};

/** Per-client lines for the income report: meetings held, expected and
 *  received, sorted by received then expected. */
export function clientBreakdown(
  sessions: RawSession[],
  entries: IncomeEntry[],
  now: Date = new Date(),
): ClientRow[] {
  const rows = new Map<string, ClientRow>();
  const row = (clientId: string, name: string) => {
    let r = rows.get(clientId);
    if (!r) {
      r = { clientId, name, held: 0, expected: 0, received: 0 };
      rows.set(clientId, r);
    }
    return r;
  };
  for (const s of sessions) {
    const r = row(s.clientId, s.clientName);
    if (tookPlace(s, now)) r.held += 1;
    if (s.status === "SCHEDULED" || s.status === "COMPLETED") r.expected += s.rate ?? 0;
  }
  for (const e of entries) row(e.clientId, e.clientName).received += e.amount;
  const round = (n: number) => Math.round(n * 100) / 100;
  return Array.from(rows.values())
    .map((r) => ({ ...r, expected: round(r.expected), received: round(r.received) }))
    .filter((r) => r.held > 0 || r.expected > 0 || r.received > 0)
    .sort((a, b) => b.received - a.received || b.expected - a.expected);
}
