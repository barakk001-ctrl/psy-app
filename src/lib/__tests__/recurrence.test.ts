import { describe, expect, it } from "vitest";
import { buildRecurrenceRule, seriesSlots } from "@/lib/recurrence";

const hour = 60 * 60 * 1000;

function jerusalemClock(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function jerusalemWeekday(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
  }).format(d);
}

describe("seriesSlots", () => {
  it("generates weekly occurrences on the same weekday and Israel time", () => {
    const slots = seriesSlots("2026-01-05T10:00", hour, 1, 4); // Monday
    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(jerusalemWeekday(slot.startsAt)).toBe("Mon");
      expect(jerusalemClock(slot.startsAt)).toBe("10:00");
      expect(slot.endsAt.getTime() - slot.startsAt.getTime()).toBe(hour);
    }
  });

  it("supports biweekly intervals", () => {
    const slots = seriesSlots("2026-01-05T10:00", hour, 2, 3);
    const days = slots.map((s) =>
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Jerusalem",
          day: "numeric",
        }).format(s.startsAt),
      ),
    );
    expect(days).toEqual([5, 19, 2]); // Jan 5, Jan 19, Feb 2
  });

  it("keeps Israel wall-clock time across the spring DST change", () => {
    // Israel DST starts 2026-03-27; a weekly 10:00 series spanning it must stay 10:00
    const slots = seriesSlots("2026-03-23T10:00", hour, 1, 3);
    for (const slot of slots) {
      expect(jerusalemClock(slot.startsAt)).toBe("10:00");
    }
    // UTC hour actually shifts when DST kicks in (07:00Z winter → 07:00Z? no: 08:00Z → 07:00Z)
    expect(slots[0].startsAt.getUTCHours()).not.toBe(slots[2].startsAt.getUTCHours());
  });

  it("returns a single slot for count 1", () => {
    const slots = seriesSlots("2026-07-19T10:00", hour, 1, 1);
    expect(slots).toHaveLength(1);
    // July = IDT (UTC+3): 10:00 Israel = 07:00Z
    expect(slots[0].startsAt.toISOString()).toBe("2026-07-19T07:00:00.000Z");
  });
});

describe("buildRecurrenceRule", () => {
  it("produces an RFC 5545 weekly rule", () => {
    expect(buildRecurrenceRule(1, 12)).toBe("FREQ=WEEKLY;INTERVAL=1;COUNT=12");
    expect(buildRecurrenceRule(2, 8)).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=8");
  });
});
