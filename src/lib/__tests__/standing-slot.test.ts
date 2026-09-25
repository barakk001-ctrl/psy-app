import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOffset,
  moveFollowers,
  seriesRootOf,
  slotLabel,
  standingSlotFollowers,
  wallClock,
  type SlotCandidate,
} from "@/lib/standing-slot";
import { fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";

const at = (local: string) => fromZonedDateTimeLocal(local);

function meeting(
  id: string,
  local: string,
  extra: Partial<SlotCandidate> = {},
): SlotCandidate {
  const startsAt = at(local);
  return {
    id,
    clientId: "c1",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 50 * 60_000),
    status: "SCHEDULED",
    seriesRootId: null,
    ...extra,
  };
}

describe("wallClock", () => {
  it("reads weekday and time on the clinic clock, not UTC", () => {
    // Tuesday 01:00 in Jerusalem is still Monday 22:00 in UTC
    const w = wallClock(at("2026-09-29T01:00"));
    expect(w).toEqual({ date: "2026-09-29", time: "01:00", weekday: 2 });
  });

  it("keeps 18:00 as 18:00 on both sides of the DST change", () => {
    // Israel leaves summer time on 2026-10-25
    const summer = at("2026-10-19T18:00");
    const winter = at("2026-10-26T18:00");
    expect(summer.getUTCHours()).not.toBe(winter.getUTCHours());
    expect(wallClock(summer).time).toBe("18:00");
    expect(wallClock(winter).time).toBe("18:00");
    expect(wallClock(summer).weekday).toBe(1);
    expect(wallClock(winter).weekday).toBe(1);
  });
});

describe("slotLabel", () => {
  it("names the clinic weekday and time", () => {
    expect(slotLabel(at("2026-09-28T18:00"))).toBe("ימי שני ב-18:00");
    expect(slotLabel(at("2026-10-03T09:30"))).toBe("ימי שבת ב-09:30");
  });
});

describe("seriesRootOf", () => {
  it("is the parent for a child, itself for a parent, null for a lone meeting", () => {
    expect(seriesRootOf({ id: "k", parentSessionId: "p", recurrenceRule: null })).toBe("p");
    expect(
      seriesRootOf({ id: "p", parentSessionId: null, recurrenceRule: "FREQ=WEEKLY;INTERVAL=1" }),
    ).toBe("p");
    expect(seriesRootOf({ id: "x", parentSessionId: null, recurrenceRule: null })).toBeNull();
  });
});

describe("standingSlotFollowers", () => {
  const now = at("2026-09-25T12:00"); // a Friday
  const anchor = {
    id: "a",
    clientId: "c1",
    startsAt: at("2026-09-28T18:00"), // Monday 18:00
    seriesRootId: null,
  };

  it("takes the client's later scheduled Monday-18:00 meetings, across DST", () => {
    const candidates = [
      meeting("m2", "2026-10-05T18:00"),
      meeting("m3", "2026-10-26T18:00"), // after the clocks change
      meeting("m1", "2026-10-12T18:00"),
    ];
    expect(standingSlotFollowers(anchor, candidates, now).map((c) => c.id)).toEqual([
      "m2",
      "m1",
      "m3",
    ]);
  });

  it("leaves out past, cancelled, completed and other clients' meetings", () => {
    const candidates = [
      meeting("past", "2026-09-21T18:00", { status: "COMPLETED" }),
      meeting("pastScheduled", "2026-09-21T18:00"),
      meeting("cancelled", "2026-10-05T18:00", { status: "CANCELLED" }),
      meeting("done", "2026-10-12T18:00", { status: "COMPLETED" }),
      meeting("other", "2026-10-19T18:00", { clientId: "c2" }),
      meeting("self", "2026-09-28T18:00", { id: "a" }),
      meeting("ok", "2026-10-26T18:00"),
    ];
    expect(standingSlotFollowers(anchor, candidates, now).map((c) => c.id)).toEqual(["ok"]);
  });

  it("leaves out ad-hoc meetings at another weekday or time", () => {
    const candidates = [
      meeting("wedSameTime", "2026-09-30T18:00"),
      meeting("monOtherTime", "2026-10-05T10:00"),
      meeting("monNearTime", "2026-10-05T18:30"),
      meeting("slot", "2026-10-05T18:00"),
    ];
    expect(standingSlotFollowers(anchor, candidates, now).map((c) => c.id)).toEqual(["slot"]);
  });

  it("includes series members even if one was moved to another time", () => {
    const seriesAnchor = { ...anchor, seriesRootId: "root" };
    const candidates = [
      meeting("movedInSeries", "2026-10-06T09:00", { seriesRootId: "root" }),
      meeting("adHoc", "2026-10-06T09:00"),
    ];
    expect(
      standingSlotFollowers(seriesAnchor, candidates, now).map((c) => c.id),
    ).toEqual(["movedInSeries"]);
  });

  it("never reaches back before now even when the edited meeting is in the past", () => {
    const pastAnchor = { ...anchor, startsAt: at("2026-09-14T18:00") };
    const candidates = [
      meeting("stillPast", "2026-09-21T18:00"),
      meeting("future", "2026-09-28T18:00"),
    ];
    expect(standingSlotFollowers(pastAnchor, candidates, now).map((c) => c.id)).toEqual([
      "future",
    ]);
  });

  it("only follows meetings after the edited one, not earlier future ones", () => {
    const later = { ...anchor, startsAt: at("2026-10-12T18:00") };
    const candidates = [meeting("before", "2026-10-05T18:00"), meeting("after", "2026-10-19T18:00")];
    expect(standingSlotFollowers(later, candidates, now).map((c) => c.id)).toEqual(["after"]);
  });
});

describe("dayOffset / addDays", () => {
  it("counts calendar days, across months and DST", () => {
    expect(dayOffset("2026-09-28", "2026-09-30")).toBe(2);
    expect(dayOffset("2026-10-26", "2026-10-25")).toBe(-1);
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("moveFollowers", () => {
  it("moves Monday 18:00 to Wednesday 17:00 for every following week, across DST", () => {
    const followers = [
      { id: "m2", startsAt: at("2026-10-05T18:00") },
      { id: "m4", startsAt: at("2026-10-26T18:00") },
    ];
    const moved = moveFollowers(followers, at("2026-09-28T18:00"), "2026-09-30", "17:00", 50);
    expect(moved.map((m) => [m.id, toZonedDateTimeLocal(m.startsAt)])).toEqual([
      ["m2", "2026-10-07T17:00"],
      ["m4", "2026-10-28T17:00"],
    ]);
    expect(moved.map((m) => toZonedDateTimeLocal(m.endsAt))).toEqual([
      "2026-10-07T17:50",
      "2026-10-28T17:50",
    ]);
    expect(moved.every((m) => wallClock(m.startsAt).weekday === 3)).toBe(true);
  });

  it("moves earlier in the week too, and a time-only change keeps the day", () => {
    const followers = [{ id: "m2", startsAt: at("2026-10-05T18:00") }];
    const earlier = moveFollowers(followers, at("2026-09-28T18:00"), "2026-09-27", "18:00", 45);
    expect(toZonedDateTimeLocal(earlier[0].startsAt)).toBe("2026-10-04T18:00");
    const sameDay = moveFollowers(followers, at("2026-09-28T18:00"), "2026-09-28", "19:15", 60);
    expect(toZonedDateTimeLocal(sameDay[0].startsAt)).toBe("2026-10-05T19:15");
    expect(toZonedDateTimeLocal(sameDay[0].endsAt)).toBe("2026-10-05T20:15");
  });
});
