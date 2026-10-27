import { describe, expect, it } from "vitest";
import { MIN_SPAN_HOURS, hourRange, minutesOfDay, slotTime } from "@/lib/calendar-hours";

const at = (h: number, m = 0) => h * 60 + m;

describe("hourRange", () => {
  it("shows the usual working day when there are no meetings", () => {
    expect(hourRange([])).toEqual({ first: 8, last: 21 });
  });

  it("spans the meetings with an hour either side", () => {
    expect(
      hourRange([
        { start: at(8, 30), end: at(9, 20) },
        { start: at(19, 0), end: at(19, 50) },
      ]),
    ).toEqual({ first: 7, last: 21 });
  });

  it("never shows fewer than MIN_SPAN_HOURS", () => {
    const r = hourRange([{ start: at(10), end: at(10, 50) }]);
    expect(r.last - r.first).toBe(MIN_SPAN_HOURS);
    expect(r.first).toBeLessThanOrEqual(9);
    expect(r.last).toBeGreaterThanOrEqual(12);
  });

  it("stays inside the day", () => {
    expect(hourRange([{ start: at(0, 30), end: at(1, 20) }]).first).toBe(0);
    const late = hourRange([{ start: at(22, 30), end: at(23, 20) }]);
    expect(late.last).toBe(24);
    expect(late.last - late.first).toBe(MIN_SPAN_HOURS);
  });

  it("counts a meeting past midnight to the end of the day", () => {
    expect(hourRange([{ start: at(23), end: at(0, 30) }]).last).toBe(24);
  });
});

describe("helpers", () => {
  it("format slot times and read local minutes", () => {
    expect(slotTime(7)).toBe("07:00:00");
    expect(slotTime(24)).toBe("24:00:00");
    expect(minutesOfDay(new Date(2026, 9, 27, 18, 45))).toBe(18 * 60 + 45);
  });
});
