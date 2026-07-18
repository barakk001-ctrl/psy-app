import { describe, expect, it } from "vitest";
import { fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";

describe("fromZonedDateTimeLocal", () => {
  it("interprets summer times as IDT (UTC+3)", () => {
    expect(fromZonedDateTimeLocal("2026-07-19T00:16").toISOString()).toBe(
      "2026-07-18T21:16:00.000Z",
    );
    expect(fromZonedDateTimeLocal("2026-07-19T10:00").toISOString()).toBe(
      "2026-07-19T07:00:00.000Z",
    );
  });

  it("interprets winter times as IST (UTC+2)", () => {
    expect(fromZonedDateTimeLocal("2026-01-15T10:00").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("is independent of the machine timezone", () => {
    // The conversion must give identical results wherever the server runs
    const d = fromZonedDateTimeLocal("2026-07-19T12:30");
    expect(d.toISOString()).toBe("2026-07-19T09:30:00.000Z");
  });
});

describe("toZonedDateTimeLocal", () => {
  it("formats a UTC instant as Israel wall-clock", () => {
    expect(toZonedDateTimeLocal(new Date("2026-07-18T21:16:00.000Z"))).toBe(
      "2026-07-19T00:16",
    );
    expect(toZonedDateTimeLocal(new Date("2026-01-15T08:00:00.000Z"))).toBe(
      "2026-01-15T10:00",
    );
  });

  it("round-trips with fromZonedDateTimeLocal", () => {
    for (const v of ["2026-07-19T00:16", "2026-01-15T10:00", "2026-03-27T01:30"]) {
      expect(toZonedDateTimeLocal(fromZonedDateTimeLocal(v))).toBe(v);
    }
  });
});
