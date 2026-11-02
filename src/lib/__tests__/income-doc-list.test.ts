import { describe, expect, it } from "vitest";
import {
  docListHref,
  docListWhere,
  draftsWhere,
  groupByMonth,
  monthLabel,
  monthsBefore,
  parseDocListFilters,
} from "@/lib/income-doc-list";

describe("the income documents list", () => {
  it("defaults to the last 12 months of documents, and ignores what it doesn't know", () => {
    expect(parseDocListFilters({})).toEqual({
      view: "documents",
      period: "12m",
      from: "",
      to: "",
      type: "all",
      status: "all",
    });
    const f = parseDocListFilters({ view: "x", period: "x", type: "999", status: "x", from: "1'; drop" });
    expect(f.period).toBe("12m");
    expect(f.type).toBe("all");
    expect(f.status).toBe("all");
    expect(f.from).toBe("");
  });

  it("round-trips through the URL, leaving defaults out", () => {
    expect(docListHref(parseDocListFilters({}))).toBe("/invoices");
    const href = "/invoices?view=drafts";
    expect(docListHref(parseDocListFilters({ view: "drafts" }))).toBe(href);
    expect(
      docListHref(parseDocListFilters({ period: "custom", from: "2026-01-01", to: "2026-02-01", type: "330", status: "paid" })),
    ).toBe("/invoices?period=custom&from=2026-01-01&to=2026-02-01&type=330&status=paid");
  });

  it("steps back whole months, landing on a real day", () => {
    expect(monthsBefore("2026-11-02", 1)).toBe("2026-10-02");
    expect(monthsBefore("2026-03-31", 1)).toBe("2026-02-28");
    expect(monthsBefore("2026-01-15", 1)).toBe("2025-12-15");
    expect(monthsBefore("2026-11-02", 12)).toBe("2025-11-02");
  });

  it("scopes every query by the user", () => {
    for (const q of [
      docListWhere("u1", parseDocListFilters({}), "2026-11-02"),
      docListWhere("u1", parseDocListFilters({ view: "drafts" }), "2026-11-02"),
      draftsWhere("u1"),
    ]) {
      expect(q.userId).toBe("u1");
    }
  });

  it("keeps drafts out of the documents and cancelled drafts out of both", () => {
    const drafts = draftsWhere("u");
    expect(drafts.morningDocNumber).toBeNull();
    expect(drafts.status).toEqual({ not: "CANCELLED" });
    const docs = docListWhere("u", parseDocListFilters({ period: "all" }), "2026-11-02");
    expect(docs.OR).toEqual([{ docType: null }, { morningDocNumber: { not: null } }]);
    expect(docs.issueDate).toBeUndefined();
  });

  it("filters by period, type and status", () => {
    const w = docListWhere("u", parseDocListFilters({ period: "month", type: "305", status: "open" }), "2026-11-02");
    expect(w.docType).toBe(305);
    expect(w.status).toEqual({ in: ["SENT", "PARTIALLY_PAID"] });
    expect(w.issueDate).toEqual({ gte: new Date("2026-10-02T00:00:00.000Z") });
    const c = docListWhere("u", parseDocListFilters({ period: "custom", from: "2026-01-01", to: "2026-01-31" }), "2026-11-02");
    expect(c.issueDate).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-01-31T00:00:00.000Z"),
    });
  });

  it("groups rows under their month, in order", () => {
    const groups = groupByMonth(["2026-11-02", "2026-11-01", "2026-10-31", "2025-10-01"], (d) => d);
    expect(groups.map((g) => g.key)).toEqual(["2026-11", "2026-10", "2025-10"]);
    expect(groups[0].rows).toHaveLength(2);
    expect(monthLabel("2026-10")).toContain("אוקטובר");
    expect(monthLabel("2026-10")).toContain("2026");
  });
});
