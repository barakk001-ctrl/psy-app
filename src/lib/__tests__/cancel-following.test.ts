import { describe, expect, it } from "vitest";
import {
  cancelFollowingNotice,
  cancelFollowingResult,
  followingCounts,
  followingCutoff,
  followingTotal,
  needsFollowingConfirm,
} from "@/lib/cancel-following";
import { planFutureDelete, type BulkDeleteCandidate } from "@/lib/bulk-delete";

const now = new Date("2026-10-04T09:00:00Z");

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

describe("followingCutoff", () => {
  it("is the cancelled meeting for a future meeting, now for a past one", () => {
    const future = new Date("2026-10-20T15:00:00Z");
    expect(followingCutoff(future, now)).toEqual(future);
    expect(followingCutoff(new Date("2026-09-01T15:00:00Z"), now)).toEqual(now);
  });
});

describe("cancel all following — the meeting page's bulk rules after this meeting", () => {
  // The client: tomorrow, the meeting being cancelled (13th), then 3 more —
  // one holding a summary
  const meetings = [
    s("tomorrow", "2026-10-05T15:00:00Z"),
    s("this", "2026-10-13T15:00:00Z"),
    s("a", "2026-10-20T15:00:00Z"),
    s("b", "2026-10-27T15:00:00Z", { hasNote: true }),
    s("c", "2026-11-03T15:00:00Z"),
  ];
  const cutoff = followingCutoff(new Date("2026-10-13T15:00:00Z"), now);
  const plan = { ...planFutureDelete(meetings, cutoff), scheduledKeepIds: ["b"] };

  it("leaves earlier meetings and the cancelled one itself alone", () => {
    expect(plan.deleteIds).toEqual(["a", "c"]);
    expect(plan.keep.map((k) => k.id)).toEqual(["b"]);
    const c = followingCounts(plan, "this");
    expect(c).toEqual({ remove: 2, keep: 1, keepReasons: "סיכום" });
    expect(followingTotal(c)).toBe(3);
  });

  it("explains the counts before saving and the result after", () => {
    const c = followingCounts(plan, "this");
    expect(cancelFollowingNotice(c, "דנה כהן")).toBe(
      "יוסרו מהיומן גם 3 הפגישות הבאות של דנה כהן. אחת מהן, שיש בה סיכום, תישאר ברשומה כמבוטלת.",
    );
    expect(cancelFollowingNotice({ remove: 1, keep: 0, keepReasons: "" }, "דנה")).toBe(
      "תוסר מהיומן גם הפגישה הבאה של דנה.",
    );
    expect(cancelFollowingResult(c, "דנה כהן")).toBe(
      "הפגישה בוטלה, וגם 3 הפגישות הבאות של דנה כהן הוסרו מהיומן (אחת מהן נשמרה ברשומה כמבוטלת).",
    );
    expect(cancelFollowingResult({ remove: 2, keep: 0, keepReasons: "" }, "דנה")).toBe(
      "הפגישה בוטלה, וגם 2 הפגישות הבאות של דנה הוסרו מהיומן.",
    );
  });

  it("asks again if more meetings appeared than were approved", () => {
    const c = { remove: 4, keep: 0, keepReasons: "" };
    expect(needsFollowingConfirm(c, null)).toBe(true);
    expect(needsFollowingConfirm(c, 4)).toBe(false);
    expect(needsFollowingConfirm(c, 3)).toBe(true);
    expect(needsFollowingConfirm({ remove: 0, keep: 0, keepReasons: "" }, null)).toBe(false);
  });
});
