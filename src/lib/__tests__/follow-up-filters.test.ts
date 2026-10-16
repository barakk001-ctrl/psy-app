import { describe, expect, it } from "vitest";
import {
  COLLECT_STATUSES,
  DEFAULT_COLLECT_STATUS,
  DEFAULT_DOCUMENT_STATUS,
  DOCUMENT_STATUSES,
  MAX_ROWS,
  PAGE_SIZE,
  attentionFirst,
  collectBadge,
  collectWhere,
  documentWhere,
  followUpHref,
  followUpRange,
  hasActiveFilters,
  matchClients,
  parseFollowUpFilters,
  periodPhrase,
  periodShortLabel,
  sessionCountLabel,
} from "@/lib/follow-up-filters";
import { toZonedDateTimeLocal } from "@/lib/timezone";

const parseDoc = (p: Record<string, string | string[] | undefined>) =>
  parseFollowUpFilters(p, DOCUMENT_STATUSES, DEFAULT_DOCUMENT_STATUS);
const parseCollect = (p: Record<string, string | string[] | undefined>) =>
  parseFollowUpFilters(p, COLLECT_STATUSES, DEFAULT_COLLECT_STATUS);

// Thursday 2026-10-15 14:30 in the clinic (11:30 UTC)
const NOW = new Date("2026-10-15T11:30:00.000Z");
const clinic = (d: Date) => toZonedDateTimeLocal(d);

describe("parseFollowUpFilters", () => {
  it("defaults to 3 weeks, every client, the page's default status, one page", () => {
    expect(parseDoc({})).toEqual({
      period: "3w",
      from: null,
      to: null,
      clientId: null,
      status: "all",
      limit: PAGE_SIZE,
    });
    expect(parseCollect({}).status).toBe("pending");
  });

  it("reads a preset period and a status", () => {
    expect(parseDoc({ period: "6w", status: "missing" })).toMatchObject({ period: "6w", status: "missing" });
    expect(parseCollect({ period: "1y", status: "unpaid" })).toMatchObject({ period: "1y", status: "unpaid" });
  });

  it("ignores unknown values", () => {
    expect(parseDoc({ period: "2d", status: "paid", client: "x" })).toMatchObject({
      period: "3w",
      status: "all",
      clientId: null,
    });
  });

  it("takes a custom range only when both dates are valid and ordered", () => {
    expect(parseDoc({ period: "custom", from: "2026-09-01", to: "2026-09-30" })).toMatchObject({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(parseDoc({ period: "custom", from: "2026-09-30", to: "2026-09-01" }).period).toBe("3w");
    expect(parseDoc({ period: "custom", from: "2026-09-01" }).period).toBe("3w");
    expect(parseDoc({ period: "custom", from: "2026-02-30", to: "2026-03-01" }).period).toBe("3w");
  });

  it("keeps a client id that looks like a cuid", () => {
    expect(parseDoc({ client: "cm2abcdefghij12345" }).clientId).toBe("cm2abcdefghij12345");
    expect(parseDoc({ client: "<script>" }).clientId).toBeNull();
    expect(parseDoc({ client: ["cm2abcdefghij12345", "other"] }).clientId).toBe("cm2abcdefghij12345");
  });

  it("rounds the row count up to whole pages and caps it", () => {
    expect(parseDoc({ n: "41" }).limit).toBe(PAGE_SIZE * 2);
    expect(parseDoc({ n: "80" }).limit).toBe(80);
    expect(parseDoc({ n: "99999" }).limit).toBe(MAX_ROWS);
    expect(parseDoc({ n: "-5" }).limit).toBe(PAGE_SIZE);
    expect(parseDoc({ n: "abc" }).limit).toBe(PAGE_SIZE);
  });
});

describe("followUpRange", () => {
  it("3 weeks = from the start of the clinic day 21 days ago up to now", () => {
    const r = followUpRange({ period: "3w", from: null, to: null }, NOW);
    expect(clinic(r.from)).toBe("2026-09-24T00:00");
    expect(r.to).toEqual(NOW);
  });

  it("6 weeks, 3 months and a year go back by the clinic calendar", () => {
    expect(clinic(followUpRange({ period: "6w", from: null, to: null }, NOW).from)).toBe("2026-09-03T00:00");
    expect(clinic(followUpRange({ period: "3m", from: null, to: null }, NOW).from)).toBe("2026-07-15T00:00");
    expect(clinic(followUpRange({ period: "1y", from: null, to: null }, NOW).from)).toBe("2025-10-15T00:00");
  });

  it("a custom range covers whole clinic days and never passes now", () => {
    const r = followUpRange({ period: "custom", from: "2026-09-01", to: "2026-09-15" }, NOW);
    expect(clinic(r.from)).toBe("2026-09-01T00:00");
    expect(clinic(r.to)).toBe("2026-09-16T00:00");
    const future = followUpRange({ period: "custom", from: "2026-10-01", to: "2026-12-31" }, NOW);
    expect(future.to).toEqual(NOW);
  });
});

describe("period labels", () => {
  it("phrases the subtitle", () => {
    expect(periodPhrase({ period: "3w", from: null, to: null })).toBe("משלושת השבועות האחרונים");
    expect(periodPhrase({ period: "1y", from: null, to: null })).toBe("מהשנה האחרונה");
    expect(periodPhrase({ period: "custom", from: "2026-09-01", to: "2026-09-15" })).toBe("מ-1.9.2026 עד 15.9.2026");
    expect(periodPhrase({ period: "custom", from: "2026-09-01", to: "2026-09-30" })).toBe("מספטמבר 2026");
    expect(periodPhrase({ period: "custom", from: "2026-09-01", to: "2026-09-01" })).toBe("ב-1.9.2026");
  });
  it("has a short label for the summary line", () => {
    expect(periodShortLabel({ period: "3m", from: null, to: null })).toBe("3 החודשים האחרונים");
    expect(periodShortLabel({ period: "custom", from: "2026-09-01", to: "2026-09-15" })).toBe("1.9.2026 עד 15.9.2026");
  });
});

describe("where builders", () => {
  it("documentWhere scopes by user, period and status", () => {
    const base = documentWhere("u1", parseDoc({}), NOW);
    expect(base.userId).toBe("u1");
    expect(base.status).toEqual({ in: ["SCHEDULED", "COMPLETED"] });
    expect(base.startsAt).toEqual({ gte: expect.any(Date), lt: NOW });
    expect(base.note).toBeUndefined();
    expect(base.clientId).toBeUndefined();

    expect(documentWhere("u1", parseDoc({ status: "missing" }), NOW).note).toEqual({ is: null });
    expect(documentWhere("u1", parseDoc({ status: "documented" }), NOW).note).toEqual({ isNot: null });
    expect(documentWhere("u1", parseDoc({ client: "cm2abcdefghij12345" }), NOW).clientId).toBe("cm2abcdefghij12345");
  });

  it("collectWhere maps each status to the payment fields", () => {
    const pending = collectWhere("u1", parseCollect({}), NOW);
    expect(pending.paymentStatus).toBeNull();
    expect(pending.invoiceItem).toEqual({ is: null });

    const all = collectWhere("u1", parseCollect({ status: "all" }), NOW);
    expect(all.paymentStatus).toBeUndefined();
    expect(all.invoiceItem).toBeUndefined();

    expect(collectWhere("u1", parseCollect({ status: "unpaid" }), NOW).paymentStatus).toBe("UNPAID");
    expect(collectWhere("u1", parseCollect({ status: "paid" }), NOW).paymentStatus).toBe("PAID");
  });
});

describe("row helpers", () => {
  it("attentionFirst keeps each group's order", () => {
    const rows = [
      { id: 1, done: true },
      { id: 2, done: false },
      { id: 3, done: true },
      { id: 4, done: false },
    ];
    expect(attentionFirst(rows, (r) => !r.done).map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  it("collectBadge tells the five cases apart", () => {
    expect(collectBadge({ paymentStatus: null, hasInvoice: false })).toBe("pending");
    expect(collectBadge({ paymentStatus: null, hasInvoice: true })).toBe("invoiced");
    expect(collectBadge({ paymentStatus: "UNPAID", hasInvoice: false })).toBe("unpaid");
    expect(collectBadge({ paymentStatus: "PAID", hasInvoice: true })).toBe("paid");
    expect(collectBadge({ paymentStatus: "EXEMPT", hasInvoice: false })).toBe("exempt");
  });

  it("counts in Hebrew", () => {
    expect(sessionCountLabel(0)).toBe("אין פגישות");
    expect(sessionCountLabel(1)).toBe("פגישה אחת");
    expect(sessionCountLabel(12)).toBe("12 פגישות");
  });
});

describe("followUpHref", () => {
  it("leaves defaults out so the plain address is the default view", () => {
    expect(followUpHref("/document", {}, "all")).toBe("/document");
    expect(followUpHref("/document", { period: "3w", status: "all", limit: PAGE_SIZE }, "all")).toBe("/document");
    expect(followUpHref("/collect", { status: "pending" }, "pending")).toBe("/collect");
  });

  it("writes every non-default filter", () => {
    expect(
      followUpHref(
        "/document",
        { period: "6w", status: "missing", clientId: "cm2abcdefghij12345", limit: 80 },
        "all",
      ),
    ).toBe("/document?period=6w&client=cm2abcdefghij12345&status=missing&n=80");
    expect(followUpHref("/collect", { status: "all" }, "pending")).toBe("/collect?status=all");
  });

  it("writes a custom range only when complete, and caps n", () => {
    expect(followUpHref("/document", { period: "custom", from: "2026-09-01", to: "2026-09-15" }, "all")).toBe(
      "/document?period=custom&from=2026-09-01&to=2026-09-15",
    );
    expect(followUpHref("/document", { period: "custom", from: "2026-09-01" }, "all")).toBe("/document");
    expect(followUpHref("/document", { limit: 10_000 }, "all")).toBe(`/document?n=${MAX_ROWS}`);
  });

  it("round-trips through the parser", () => {
    const f = parseDoc({ period: "custom", from: "2026-08-01", to: "2026-08-31", status: "documented", n: "120" });
    const href = followUpHref("/document", f, "all");
    const q = Object.fromEntries(new URL(`https://x${href}`).searchParams);
    expect(parseDoc(q)).toEqual(f);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults, true for any change", () => {
    expect(hasActiveFilters(parseDoc({}), "all")).toBe(false);
    expect(hasActiveFilters(parseDoc({ n: "80" }), "all")).toBe(false);
    expect(hasActiveFilters(parseDoc({ period: "6w" }), "all")).toBe(true);
    expect(hasActiveFilters(parseDoc({ status: "missing" }), "all")).toBe(true);
    expect(hasActiveFilters(parseDoc({ client: "cm2abcdefghij12345" }), "all")).toBe(true);
  });
});

describe("matchClients", () => {
  const clients = [
    { id: "1", name: "דנה כהן", active: true },
    { id: "2", name: "יוסף לוי", active: true },
    { id: "3", name: "דן אברהם", active: false },
    { id: "4", name: "נועה כהן-לוי", active: false },
  ];

  it("returns everyone (up to the limit) for an empty query", () => {
    expect(matchClients(clients, "").map((c) => c.id)).toEqual(["1", "2", "3", "4"]);
    expect(matchClients(clients, "  ", 2).map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("matches word prefixes of first or last name", () => {
    expect(matchClients(clients, "דנ").map((c) => c.id)).toEqual(["1", "3"]);
    expect(matchClients(clients, "כהן").map((c) => c.id)).toEqual(["1", "4"]);
    expect(matchClients(clients, "דנ כ").map((c) => c.id)).toEqual(["1"]);
    expect(matchClients(clients, "לוי").map((c) => c.id)).toEqual(["2", "4"]);
  });

  it("ignores final letters and quotes", () => {
    expect(matchClients(clients, "כהנ").map((c) => c.id)).toEqual(["1", "4"]);
    expect(matchClients(clients, "יוספ").map((c) => c.id)).toEqual(["2"]);
  });

  it("finds nothing for a name that isn't there", () => {
    expect(matchClients(clients, "רונית")).toEqual([]);
  });
});
