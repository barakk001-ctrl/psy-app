import { describe, expect, it } from "vitest";
import { buildRecurrenceRule, seriesSlots } from "@/lib/recurrence";

describe("seriesSlots", () => {
  const first = new Date(2026, 0, 5, 10, 0); // Mon 2026-01-05 10:00
  const hour = 60 * 60 * 1000;

  it("generates weekly occurrences on the same weekday and time", () => {
    const slots = seriesSlots(first, hour, 1, 4);
    expect(slots).toHaveLength(4);
    for (const [i, slot] of slots.entries()) {
      expect(slot.startsAt.getDay()).toBe(1); // Monday
      expect(slot.startsAt.getHours()).toBe(10);
      expect(slot.startsAt.getDate()).toBe(5 + i * 7);
      expect(slot.endsAt.getTime() - slot.startsAt.getTime()).toBe(hour);
    }
  });

  it("supports biweekly intervals", () => {
    const slots = seriesSlots(first, hour, 2, 3);
    const days = slots.map((s) => s.startsAt.getDate());
    expect(days).toEqual([5, 19, 2]); // Jan 5, Jan 19, Feb 2
    expect(slots[2].startsAt.getMonth()).toBe(1);
  });

  it("keeps wall-clock time across the Israeli spring DST change", () => {
    // DST in Israel starts late March; a weekly series spanning it must stay at 10:00
    const beforeDst = new Date(2026, 2, 23, 10, 0); // Mon 2026-03-23
    const slots = seriesSlots(beforeDst, hour, 1, 3);
    for (const slot of slots) {
      expect(slot.startsAt.getHours()).toBe(10);
    }
  });

  it("returns a single slot for count 1", () => {
    const slots = seriesSlots(first, hour, 1, 1);
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.getTime()).toBe(first.getTime());
  });
});

describe("buildRecurrenceRule", () => {
  it("produces an RFC 5545 weekly rule", () => {
    expect(buildRecurrenceRule(1, 12)).toBe("FREQ=WEEKLY;INTERVAL=1;COUNT=12");
    expect(buildRecurrenceRule(2, 8)).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=8");
  });
});
