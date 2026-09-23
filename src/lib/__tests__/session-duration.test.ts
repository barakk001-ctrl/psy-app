import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_MINUTES,
  DURATION_CHOICES,
  addMinutesToTime,
  withDuration,
} from "../session-duration";

describe("withDuration", () => {
  it("leaves the list alone when the duration is already offered", () => {
    expect(withDuration(DURATION_CHOICES, 50)).toEqual([...DURATION_CHOICES]);
    expect(withDuration(DURATION_CHOICES, 45)).toEqual([...DURATION_CHOICES]);
  });

  it("adds an unusual duration in order, so it can be shown as selected", () => {
    // Without this the picker would have no matching option and the browser
    // would fall back to the first one, silently changing the length.
    expect(withDuration(DURATION_CHOICES, 55)).toEqual([30, 45, 50, 55, 60, 75, 90, 120]);
    expect(withDuration(DURATION_CHOICES, 20)).toEqual([20, 30, 45, 50, 60, 75, 90, 120]);
    expect(withDuration(DURATION_CHOICES, 180)).toEqual([30, 45, 50, 60, 75, 90, 120, 180]);
  });

  it("ignores a missing duration rather than adding a blank option", () => {
    expect(withDuration(DURATION_CHOICES, null)).toEqual([...DURATION_CHOICES]);
    expect(withDuration(DURATION_CHOICES, undefined)).toEqual([...DURATION_CHOICES]);
    expect(withDuration(DURATION_CHOICES, 0)).toEqual([...DURATION_CHOICES]);
  });

  it("never mutates the shared choices", () => {
    const before = [...DURATION_CHOICES];
    withDuration(DURATION_CHOICES, 55);
    expect([...DURATION_CHOICES]).toEqual(before);
  });

  it("keeps the app default among the offered choices", () => {
    expect(DURATION_CHOICES).toContain(DEFAULT_SESSION_MINUTES);
  });
});

describe("addMinutesToTime", () => {
  it("moves the end with the start by the default length", () => {
    expect(addMinutesToTime("15:00", 50)).toBe("15:50");
    expect(addMinutesToTime("09:40", 45)).toBe("10:25");
    expect(addMinutesToTime("8:20", 30)).toBe("08:50");
  });

  it("never wraps past midnight", () => {
    expect(addMinutesToTime("23:30", 50)).toBe("23:59");
  });

  it("leaves a half-typed time alone", () => {
    expect(addMinutesToTime("", 50)).toBe("");
    expect(addMinutesToTime("15:", 50)).toBe("15:");
  });
});
