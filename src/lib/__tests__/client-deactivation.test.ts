import { describe, expect, it } from "vitest";
import {
  closeRecurrenceRule,
  deactivationCount,
  deactivationNotice,
  needsDeactivationConfirm,
  planDeactivation,
  type DeactivationCandidate,
} from "@/lib/client-deactivation";
import { isOpenEndedRule, shouldTopUpSeries, TOPUP_HORIZON_MS } from "@/lib/recurrence";

const now = new Date("2026-10-03T12:00:00Z");

function s(
  id: string,
  iso: string,
  extra: Partial<DeactivationCandidate> = {},
): DeactivationCandidate {
  return {
    id,
    startsAt: new Date(iso),
    status: "SCHEDULED",
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

describe("planDeactivation", () => {
  it("deletes empty future meetings, cancels ones holding records, never touches the past", () => {
    const plan = planDeactivation(
      [
        s("past", "2026-09-20T09:00:00Z", { hasNote: false }),
        s("pastNote", "2026-09-27T09:00:00Z", { hasNote: true }),
        s("f1", "2026-10-05T09:00:00Z"),
        s("f2", "2026-10-12T09:00:00Z"),
        s("fNote", "2026-10-19T09:00:00Z", { hasNote: true }),
        s("fPaid", "2026-10-26T09:00:00Z", { paymentStatus: "PAID", paidAmount: "350" }),
      ],
      now,
    );
    expect(plan.deleteIds).toEqual(["f1", "f2"]);
    expect(plan.cancelIds).toEqual(["fNote", "fPaid"]);
    expect(plan.keep).toEqual([
      { id: "fNote", reasons: ["note"] },
      { id: "fPaid", reasons: ["payment"] },
    ]);
    expect(deactivationCount(plan)).toBe(4);
  });

  it("keeps meetings with attachments, an app invoice or a Morning document", () => {
    const plan = planDeactivation(
      [
        s("files", "2026-10-05T09:00:00Z", { fileCount: 1 }),
        s("inv", "2026-10-06T09:00:00Z", { hasInvoiceItem: true }),
        s("morning", "2026-10-07T09:00:00Z", { morningReceiptNumber: "1001" }),
      ],
      now,
    );
    expect(plan.deleteIds).toEqual([]);
    expect(plan.cancelIds).toEqual(["files", "inv", "morning"]);
  });

  it("leaves meetings already off the calendar (cancelled) alone", () => {
    const plan = planDeactivation(
      [
        s("cancelledEmpty", "2026-10-05T09:00:00Z", { status: "CANCELLED" }),
        s("cancelledNote", "2026-10-06T09:00:00Z", { status: "CANCELLED", hasNote: true }),
      ],
      now,
    );
    expect(deactivationCount(plan)).toBe(0);
    expect(deactivationNotice(plan)).toBeNull();
  });

  it("does not re-status a future meeting already marked done/no-show that holds records", () => {
    const plan = planDeactivation(
      [
        s("done", "2026-10-05T09:00:00Z", { status: "COMPLETED", hasNote: true }),
        s("noShowEmpty", "2026-10-06T09:00:00Z", { status: "NO_SHOW" }),
      ],
      now,
    );
    expect(plan.cancelIds).toEqual([]);
    expect(plan.deleteIds).toEqual(["noShowEmpty"]);
  });

  it("treats a meeting starting exactly now as past", () => {
    const plan = planDeactivation([s("now", now.toISOString())], now);
    expect(deactivationCount(plan)).toBe(0);
  });
});

describe("needsDeactivationConfirm", () => {
  const plan = planDeactivation(
    [s("a", "2026-10-05T09:00:00Z"), s("b", "2026-10-12T09:00:00Z")],
    now,
  );

  it("asks when meetings would leave the calendar and nothing was approved", () => {
    expect(needsDeactivationConfirm(plan, null)).toBe(true);
  });

  it("goes ahead once the same (or a larger) count was approved", () => {
    expect(needsDeactivationConfirm(plan, 2)).toBe(false);
    expect(needsDeactivationConfirm(plan, 3)).toBe(false);
  });

  it("asks again if more meetings appeared since she approved", () => {
    expect(needsDeactivationConfirm(plan, 1)).toBe(true);
  });

  it("just switches when there is nothing on the calendar", () => {
    expect(needsDeactivationConfirm(planDeactivation([], now), null)).toBe(false);
  });
});

describe("deactivationNotice", () => {
  const future = (n: number, extra: Partial<DeactivationCandidate> = {}) =>
    Array.from({ length: n }, (_, i) =>
      s(`${extra.hasNote ? "k" : "d"}${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T09:00:00Z`, extra),
    );

  it("names the total and the kept ones", () => {
    const plan = planDeactivation([...future(6), ...future(2, { hasNote: true })], now);
    expect(deactivationNotice(plan)).toBe(
      "יוסרו 8 פגישות עתידיות מהיומן (2 שיש בהן תיעוד/תשלום יישמרו כמבוטלות).",
    );
  });

  it("reads naturally for one, none kept, one kept and all kept", () => {
    expect(deactivationNotice(planDeactivation(future(1), now))).toBe(
      "תוסר פגישה עתידית אחת מהיומן.",
    );
    expect(deactivationNotice(planDeactivation(future(3), now))).toBe(
      "יוסרו 3 פגישות עתידיות מהיומן.",
    );
    expect(
      deactivationNotice(planDeactivation([...future(3), ...future(1, { hasNote: true })], now)),
    ).toBe("יוסרו 4 פגישות עתידיות מהיומן (אחת שיש בה תיעוד/תשלום תישמר כמבוטלת).");
    expect(deactivationNotice(planDeactivation(future(2, { hasNote: true }), now))).toBe(
      "יוסרו 2 פגישות עתידיות מהיומן (בכולן יש תיעוד/תשלום — הן יישמרו כמבוטלות).",
    );
    expect(deactivationNotice(planDeactivation(future(1, { hasNote: true }), now))).toBe(
      "תוסר פגישה עתידית אחת מהיומן (יש בה תיעוד/תשלום — היא תישמר כמבוטלת).",
    );
  });
});

describe("closeRecurrenceRule", () => {
  it("ends an open-ended series at its current size", () => {
    const closed = closeRecurrenceRule("FREQ=WEEKLY;INTERVAL=2", 7);
    expect(closed).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=7");
    expect(isOpenEndedRule(closed)).toBe(false);
  });

  it("replaces an existing count and never writes COUNT=0", () => {
    expect(closeRecurrenceRule("FREQ=WEEKLY;INTERVAL=1;COUNT=12", 4)).toBe(
      "FREQ=WEEKLY;INTERVAL=1;COUNT=4",
    );
    expect(closeRecurrenceRule("FREQ=WEEKLY;INTERVAL=1", 0)).toBe(
      "FREQ=WEEKLY;INTERVAL=1;COUNT=1",
    );
  });
});

describe("shouldTopUpSeries", () => {
  const soon = new Date(now.getTime() + TOPUP_HORIZON_MS - 1000);
  const far = new Date(now.getTime() + TOPUP_HORIZON_MS + 24 * 3600 * 1000);
  const base = {
    recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
    clientStatus: "ACTIVE",
    aliveFutureCount: 3,
    lastStartsAt: soon,
  };

  it("extends an active client's open-ended series that is running out", () => {
    expect(shouldTopUpSeries(base, now)).toBe(true);
  });

  it("never extends an inactive client's series", () => {
    expect(shouldTopUpSeries({ ...base, clientStatus: "INACTIVE" }, now)).toBe(false);
  });

  it("never resurrects a series with no booked future meeting", () => {
    expect(shouldTopUpSeries({ ...base, aliveFutureCount: 0 }, now)).toBe(false);
  });

  it("leaves fixed-count series and ones with enough ahead alone", () => {
    expect(
      shouldTopUpSeries({ ...base, recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=12" }, now),
    ).toBe(false);
    expect(shouldTopUpSeries({ ...base, lastStartsAt: far }, now)).toBe(false);
    expect(shouldTopUpSeries({ ...base, recurrenceRule: null }, now)).toBe(false);
  });

  it("does not extend a series closed when its client was made inactive, even once active again", () => {
    const closed = closeRecurrenceRule("FREQ=WEEKLY;INTERVAL=1", 10);
    expect(shouldTopUpSeries({ ...base, recurrenceRule: closed }, now)).toBe(false);
  });
});
