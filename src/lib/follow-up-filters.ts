// Filters of the two follow-up pages — "תיעוד פגישות" (/document) and
// "אישורי תשלום" (/collect): which client, which status, which period, and
// how many rows to show. Everything lives in the URL's search params so the
// back button and a refresh keep it; this module parses those params, builds
// the Prisma `where` (filtering happens in the query, never in the browser)
// and builds URLs back. Pure and tested (__tests__/follow-up-filters.test.ts);
// the pages do the DB calls.

import type { Prisma } from "@prisma/client";
import { clinicDayStart, clinicToday } from "@/lib/income";
import { parseDateRange, rangeLabel } from "@/lib/report-periods";

// ── Period ───────────────────────────────────────────────────────────────

export type PeriodKey = "3w" | "6w" | "3m" | "1y" | "custom";

export const DEFAULT_PERIOD: PeriodKey = "3w";

/** Option labels for the period control (short — they sit in a select). */
export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "3w", label: "3 שבועות" },
  { key: "6w", label: "6 שבועות" },
  { key: "3m", label: "3 חודשים" },
  { key: "1y", label: "שנה" },
  { key: "custom", label: "טווח תאריכים" },
];

const PERIOD_KEYS = new Set<string>(PERIOD_OPTIONS.map((p) => p.key));

// ── Status ───────────────────────────────────────────────────────────────

export type DocumentStatus = "all" | "missing" | "documented";
export type CollectStatus = "all" | "pending" | "unpaid" | "paid";

export type StatusOption<S extends string> = { key: S; label: string };

/** /document: labels match the row badges ("חסר תיעוד" / "מתועדת"). */
export const DOCUMENT_STATUSES: StatusOption<DocumentStatus>[] = [
  { key: "all", label: "הכול" },
  { key: "missing", label: "חסר תיעוד" },
  { key: "documented", label: "מתועדת" },
];

/** /collect: "לא עודכן תשלום" is the page's purpose and stays the default;
 *  "טרם שולם" = marked as a debt; "שולם" = marked paid. */
export const COLLECT_STATUSES: StatusOption<CollectStatus>[] = [
  { key: "all", label: "הכול" },
  { key: "pending", label: "לא עודכן תשלום" },
  { key: "unpaid", label: "טרם שולם" },
  { key: "paid", label: "שולם" },
];

export const DEFAULT_DOCUMENT_STATUS: DocumentStatus = "all";
export const DEFAULT_COLLECT_STATUS: CollectStatus = "pending";

// ── Paging ───────────────────────────────────────────────────────────────

/** Rows per "הצגת עוד" step. The list grows in place (`n` in the URL), so the
 *  loaded rows can be re-ordered as one list (missing first). */
export const PAGE_SIZE = 40;
/** A hard cap so a hand-edited URL can't ask for thousands of rows. */
export const MAX_ROWS = 400;

// ── Parsing ──────────────────────────────────────────────────────────────

export type FollowUpFilters<S extends string> = {
  period: PeriodKey;
  /** Custom range ("yyyy-mm-dd", both inclusive); set only for `custom`. */
  from: string | null;
  to: string | null;
  clientId: string | null;
  status: S;
  /** How many rows to show (a multiple of PAGE_SIZE, ≤ MAX_ROWS). */
  limit: number;
};

export type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | null {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : null;
}

const CLIENT_ID_RE = /^[a-z0-9]{10,40}$/i;

/**
 * Reads the filters from the page's search params. Anything unusable falls
 * back to the default (a `custom` period without a valid range falls back
 * to the default period, so the page always shows something sensible).
 */
export function parseFollowUpFilters<S extends string>(
  params: SearchParams,
  statuses: StatusOption<S>[],
  defaultStatus: S,
): FollowUpFilters<S> {
  const rawPeriod = one(params, "period");
  let period: PeriodKey = rawPeriod && PERIOD_KEYS.has(rawPeriod) ? (rawPeriod as PeriodKey) : DEFAULT_PERIOD;
  let from: string | null = null;
  let to: string | null = null;
  if (period === "custom") {
    const range = parseDateRange(one(params, "from"), one(params, "to"));
    if (range) {
      from = range.from;
      to = range.to;
    } else {
      period = DEFAULT_PERIOD;
    }
  }

  const rawClient = one(params, "client");
  const clientId = rawClient && CLIENT_ID_RE.test(rawClient) ? rawClient : null;

  const rawStatus = one(params, "status");
  const status = statuses.some((s) => s.key === rawStatus) ? (rawStatus as S) : defaultStatus;

  const rawN = Number(one(params, "n"));
  const limit =
    Number.isInteger(rawN) && rawN > 0
      ? Math.min(MAX_ROWS, Math.ceil(rawN / PAGE_SIZE) * PAGE_SIZE)
      : PAGE_SIZE;

  return { period, from, to, clientId, status, limit };
}

// ── Date range ───────────────────────────────────────────────────────────

function ymd(y: number, m: number, d: number): string {
  // Date.UTC normalises overflow (month 0 → December before, day 0 → last day)
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/**
 * The instants a period covers: [from, to) — `to` never passes `now`, since
 * both pages list meetings that already took place. Preset periods start at
 * the beginning of a clinic day (3 weeks = today and the 21 days before it).
 */
export function followUpRange(
  f: Pick<FollowUpFilters<string>, "period" | "from" | "to">,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const { y, m, d } = clinicToday(now);
  let from: Date;
  let to = now;
  switch (f.period) {
    case "3w":
      from = clinicDayStart(ymd(y, m, d - 21));
      break;
    case "6w":
      from = clinicDayStart(ymd(y, m, d - 42));
      break;
    case "3m":
      from = clinicDayStart(ymd(y, m - 3, d));
      break;
    case "1y":
      from = clinicDayStart(ymd(y - 1, m, d));
      break;
    case "custom": {
      // parseFollowUpFilters guarantees a valid pair for `custom`
      const range = parseDateRange(f.from, f.to);
      if (!range) return followUpRange({ period: DEFAULT_PERIOD, from: null, to: null }, now);
      from = range.range[0];
      const end = range.range[1];
      to = end.getTime() < now.getTime() ? end : now;
      break;
    }
  }
  return { from, to };
}

/** "משלושת השבועות האחרונים" — completes "פגישות …" in the subtitle. */
export function periodPhrase(f: Pick<FollowUpFilters<string>, "period" | "from" | "to">): string {
  switch (f.period) {
    case "3w":
      return "משלושת השבועות האחרונים";
    case "6w":
      return "מששת השבועות האחרונים";
    case "3m":
      return "משלושת החודשים האחרונים";
    case "1y":
      return "מהשנה האחרונה";
    case "custom": {
      if (!f.from || !f.to) return periodPhrase({ period: DEFAULT_PERIOD, from: null, to: null });
      const label = rangeLabel(f.from, f.to);
      if (f.from === f.to) return `ב-${label}`; // one day
      // "מ-1.9.2026 עד 15.9.2026", but "מספטמבר 2026" for a whole month
      return /^\d/.test(label) ? `מ-${label}` : `מ${label}`;
    }
  }
}

/** Short label for the active-filter summary ("3 השבועות האחרונים"). */
export function periodShortLabel(f: Pick<FollowUpFilters<string>, "period" | "from" | "to">): string {
  switch (f.period) {
    case "3w":
      return "3 השבועות האחרונים";
    case "6w":
      return "6 השבועות האחרונים";
    case "3m":
      return "3 החודשים האחרונים";
    case "1y":
      return "השנה האחרונה";
    case "custom":
      return f.from && f.to ? rangeLabel(f.from, f.to) : periodShortLabel({ period: DEFAULT_PERIOD, from: null, to: null });
  }
}

// ── Prisma where ─────────────────────────────────────────────────────────

/** Meetings that took place in the range: booked or completed, already started. */
function baseWhere(
  userId: string,
  f: FollowUpFilters<string>,
  now: Date,
): Prisma.SessionWhereInput {
  const range = followUpRange(f, now);
  return {
    userId,
    status: { in: ["SCHEDULED", "COMPLETED"] },
    startsAt: { gte: range.from, lt: range.to },
    ...(f.clientId ? { clientId: f.clientId } : {}),
  };
}

export function documentWhere(
  userId: string,
  f: FollowUpFilters<DocumentStatus>,
  now: Date = new Date(),
): Prisma.SessionWhereInput {
  const where = baseWhere(userId, f, now);
  if (f.status === "missing") where.note = { is: null };
  if (f.status === "documented") where.note = { isNot: null };
  return where;
}

export function collectWhere(
  userId: string,
  f: FollowUpFilters<CollectStatus>,
  now: Date = new Date(),
): Prisma.SessionWhereInput {
  const where = baseWhere(userId, f, now);
  switch (f.status) {
    case "pending":
      // No payment record and not on an app invoice (those are tracked there)
      where.paymentStatus = null;
      where.invoiceItem = { is: null };
      break;
    case "unpaid":
      where.paymentStatus = "UNPAID";
      break;
    case "paid":
      where.paymentStatus = "PAID";
      break;
  }
  return where;
}

// ── Row helpers ──────────────────────────────────────────────────────────

/** Stable sort: rows still needing attention first, each group keeping its
 *  order (newest first as loaded). Applied to the loaded rows only — the
 *  list grows in place, so the order never jumps between pages. */
export function attentionFirst<T>(rows: T[], needsAttention: (row: T) => boolean): T[] {
  const first: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (needsAttention(r) ? first : rest).push(r);
  return [...first, ...rest];
}

export type CollectBadge = "pending" | "unpaid" | "paid" | "exempt" | "invoiced";

/** What a /collect row says about its payment. */
export function collectBadge(s: {
  paymentStatus: string | null;
  hasInvoice: boolean;
}): CollectBadge {
  if (s.paymentStatus === "PAID") return "paid";
  if (s.paymentStatus === "UNPAID") return "unpaid";
  if (s.paymentStatus === "EXEMPT") return "exempt";
  return s.hasInvoice ? "invoiced" : "pending";
}

export const COLLECT_BADGE_LABELS: Record<CollectBadge, string> = {
  pending: "לא עודכן תשלום",
  unpaid: "טרם שולם",
  paid: "שולם",
  exempt: "ללא תשלום",
  invoiced: "בחשבונית",
};

// ── URLs ─────────────────────────────────────────────────────────────────

/** The page URL for a set of filters — defaults are left out, so the plain
 *  page address means "the default view". `n` is kept only above a page. */
export function followUpHref<S extends string>(
  basePath: string,
  f: Partial<FollowUpFilters<S>>,
  defaultStatus: S,
): string {
  const q = new URLSearchParams();
  const period = f.period ?? DEFAULT_PERIOD;
  if (period === "custom" && f.from && f.to) {
    q.set("period", "custom");
    q.set("from", f.from);
    q.set("to", f.to);
  } else if (period !== DEFAULT_PERIOD && period !== "custom") {
    q.set("period", period);
  }
  if (f.clientId) q.set("client", f.clientId);
  if (f.status && f.status !== defaultStatus) q.set("status", f.status);
  if (f.limit && f.limit > PAGE_SIZE) q.set("n", String(Math.min(MAX_ROWS, f.limit)));
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** True when anything but the defaults is chosen (shows "נקה סינון"). */
export function hasActiveFilters<S extends string>(f: FollowUpFilters<S>, defaultStatus: S): boolean {
  return f.period !== DEFAULT_PERIOD || !!f.clientId || f.status !== defaultStatus;
}

/** "3 פגישות" / "פגישה אחת" / "אין פגישות". */
export function sessionCountLabel(n: number): string {
  if (n === 0) return "אין פגישות";
  if (n === 1) return "פגישה אחת";
  return `${n} פגישות`;
}

// ── Client type-ahead ────────────────────────────────────────────────────

export type ClientChoice = { id: string; name: string; active: boolean };

function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // niqqud
    .replace(/["'`״׳]/g, "")
    .replace(/[ךםןףץ]/g, (c) => ({ ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" })[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, " ") // "כהן-לוי" → two words
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Type-ahead over client names: every typed word must start some word of the
 * name (so "דנ כ" finds "דנה כהן"), final letters and quotes ignored. Empty
 * query → everyone. Active clients first (the list is already in that order).
 */
export function matchClients<T extends { name: string }>(clients: T[], query: string, limit = 8): T[] {
  const words = foldName(query).split(" ").filter(Boolean);
  if (words.length === 0) return clients.slice(0, limit);
  const out: T[] = [];
  for (const c of clients) {
    const nameWords = foldName(c.name).split(" ");
    if (words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
