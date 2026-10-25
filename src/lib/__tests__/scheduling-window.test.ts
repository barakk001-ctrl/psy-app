import { describe, expect, it } from "vitest";
import {
  FOLLOWER_GRACE_DAYS,
  TRIAL_SCHEDULING_DAYS,
  addDays,
  pickerMax,
  windowUi,
  beyondWindow,
  followersWindowError,
  schedulingWindow,
  seriesWindowError,
  slotsInWindow,
  topUpPolicy,
  windowError,
} from "@/lib/scheduling-window";
import { seriesSlots } from "@/lib/recurrence";
import { fromZonedDateTimeLocal } from "@/lib/timezone";

// 25 Oct 2026, 10:00 in Israel (after the DST change on the 25th: UTC+2)
const NOW = fromZonedDateTimeLocal("2026-10-25T10:00");

describe("schedulingWindow", () => {
  it("limits only the free trial", () => {
    expect(schedulingWindow({ status: "trial" }, NOW)).not.toBeNull();
    expect(schedulingWindow({ status: "active" }, NOW)).toBeNull();
    expect(schedulingWindow({ status: "exempt" }, NOW)).toBeNull();
    // expired accounts are read-only anyway; no window is needed for them
    expect(schedulingWindow({ status: "expired" }, NOW)).toBeNull();
  });

  it("runs to the end of the clinic day TRIAL_SCHEDULING_DAYS ahead", () => {
    const w = schedulingWindow({ status: "trial" }, NOW)!;
    expect(TRIAL_SCHEDULING_DAYS).toBe(30);
    expect(w.lastDay).toBe("2026-11-24");
    expect(w.limit.getTime()).toBe(fromZonedDateTimeLocal("2026-11-25T00:00").getTime());
    expect(beyondWindow(fromZonedDateTimeLocal("2026-11-24T23:30"), w)).toBe(false);
    expect(beyondWindow(fromZonedDateTimeLocal("2026-11-25T00:00"), w)).toBe(true);
  });

  it("uses the clinic date, not the UTC one, late at night", () => {
    // 23:30 in Israel on 31 Dec is still 31 Dec there (21:30 UTC)
    const late = fromZonedDateTimeLocal("2026-12-31T23:30");
    expect(schedulingWindow({ status: "trial" }, late)!.lastDay).toBe("2027-01-30");
    // 00:30 on 1 Jan in Israel is still 31 Dec in UTC — the clinic day counts
    const early = fromZonedDateTimeLocal("2027-01-01T00:30");
    expect(schedulingWindow({ status: "trial" }, early)!.lastDay).toBe("2027-01-31");
  });

  it("is open without a window", () => {
    expect(beyondWindow(new Date("2030-01-01"), null)).toBe(false);
  });

  it("lets following meetings run a grace week past the window", () => {
    const w = schedulingWindow({ status: "trial" }, NOW)!;
    const fourDaysPast = fromZonedDateTimeLocal("2026-11-28T18:00");
    expect(beyondWindow(fourDaysPast, w)).toBe(true);
    expect(beyondWindow(fourDaysPast, w, FOLLOWER_GRACE_DAYS)).toBe(false);
    expect(
      beyondWindow(fromZonedDateTimeLocal("2026-12-02T00:00"), w, FOLLOWER_GRACE_DAYS),
    ).toBe(true);
  });
});

describe("slotsInWindow", () => {
  it("keeps a weekly series' meetings inside the window only", () => {
    const w = schedulingWindow({ status: "trial" }, NOW)!;
    const slots = seriesSlots("2026-10-27T18:00", 50 * 60_000, 1, 26);
    const kept = slotsInWindow(slots, w);
    // 27.10, 3.11, 10.11, 17.11, 24.11
    expect(kept).toHaveLength(5);
    expect(kept.at(-1)!.startsAt.getTime()).toBe(
      fromZonedDateTimeLocal("2026-11-24T18:00").getTime(),
    );
    expect(slotsInWindow(slots, null)).toHaveLength(26);
  });
});

describe("topUpPolicy", () => {
  it("grows paid and exempt series as usual, trial ones inside the window, expired ones not at all", () => {
    expect(topUpPolicy({ status: "active" })).toBe("normal");
    expect(topUpPolicy({ status: "exempt" })).toBe("normal");
    expect(topUpPolicy({ status: "trial" })).toBe("window");
    expect(topUpPolicy({ status: "expired" })).toBe("none");
  });
});

describe("messages", () => {
  const w = schedulingWindow({ status: "trial" }, NOW)!;
  it("name the limit and the way out", () => {
    expect(windowError(w)).toContain("30 יום קדימה");
    expect(windowError(w)).toContain("2026");
    expect(windowError(w)).toContain("״מנוי ומסלולים״");
    expect(followersWindowError(w)).toContain("להזיז רק את הפגישה הזו");
  });
  it("offer open-ended or fewer meetings for a long series", () => {
    expect(seriesWindowError(w, 5)).toContain("עד 5 פגישות");
    expect(seriesWindowError(w, 5)).toContain("קבוע — ללא תאריך סיום");
    expect(seriesWindowError(w, 1)).not.toContain("עד 1 פגישות");
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("date pickers", () => {
  const ui = windowUi(schedulingWindow({ status: "trial" }, NOW));
  it("cap the picker at the last day", () => {
    expect(ui).toMatchObject({ lastDay: "2026-11-24" });
    expect(ui!.hint).toContain("30 יום קדימה");
    expect(pickerMax(ui, "date")).toBe("2026-11-24");
    expect(pickerMax(ui, "datetime-local", "2026-11-01T10:00")).toBe("2026-11-24T23:59");
  });
  it("leave a meeting already past the limit editable, and paid accounts open", () => {
    expect(pickerMax(ui, "datetime-local", "2027-01-05T10:00")).toBeUndefined();
    expect(pickerMax(null, "date")).toBeUndefined();
    expect(windowUi(null)).toBeNull();
  });
});
