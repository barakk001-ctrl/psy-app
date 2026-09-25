import { describe, expect, it } from "vitest";
import {
  keepReasons,
  keepReasonsText,
  planFutureDelete,
  type BulkDeleteCandidate,
} from "@/lib/bulk-delete";

const now = new Date("2026-09-25T12:00:00Z");

function s(id: string, iso: string, extra: Partial<BulkDeleteCandidate> = {}): BulkDeleteCandidate {
  return {
    id,
    startsAt: new Date(iso),
    hasNote: false,
    fileCount: 0,
    hasInvoiceItem: false,
    paymentStatus: null,
    paidAmount: null,
    morningDocNumber: null,
    morningReceiptNumber: null,
    morningInvoiceReceiptNumber: null,
    ...extra,
  };
}

describe("keepReasons", () => {
  it("is empty for a bare meeting", () => {
    expect(keepReasons(s("a", "2026-10-01T15:00:00Z"))).toEqual([]);
  });

  it("names every kind of record a meeting holds", () => {
    expect(
      keepReasons(
        s("a", "2026-10-01T15:00:00Z", {
          hasNote: true,
          fileCount: 2,
          paymentStatus: "PAID",
          hasInvoiceItem: true,
          morningReceiptNumber: "1001",
        }),
      ),
    ).toEqual(["note", "files", "payment", "invoice", "morning"]);
    expect(keepReasons(s("b", "2026-10-01T15:00:00Z", { paidAmount: 0 }))).toEqual(["payment"]);
    expect(
      keepReasons(s("c", "2026-10-01T15:00:00Z", { morningInvoiceReceiptNumber: "7" })),
    ).toEqual(["morning"]);
  });
});

describe("planFutureDelete", () => {
  it("never touches a meeting that already started", () => {
    const plan = planFutureDelete(
      [
        s("past", "2026-09-20T15:00:00Z"),
        s("rightNow", "2026-09-25T12:00:00Z"),
        s("future", "2026-09-25T12:01:00Z"),
      ],
      now,
    );
    expect(plan.deleteIds).toEqual(["future"]);
    expect(plan.keep).toEqual([]);
  });

  it("keeps future meetings that hold notes, files or billing", () => {
    const plan = planFutureDelete(
      [
        s("empty", "2026-10-01T15:00:00Z"),
        s("noted", "2026-10-08T15:00:00Z", { hasNote: true }),
        s("prepaid", "2026-10-15T15:00:00Z", { paymentStatus: "PAID", paidAmount: "400" }),
        s("empty2", "2026-10-22T15:00:00Z"),
      ],
      now,
    );
    expect(plan.deleteIds).toEqual(["empty", "empty2"]);
    expect(plan.keep).toEqual([
      { id: "noted", reasons: ["note"] },
      { id: "prepaid", reasons: ["payment"] },
    ]);
    expect(keepReasonsText(plan.keep)).toBe("סיכום, רישום תשלום");
  });
});
