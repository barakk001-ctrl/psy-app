import { describe, expect, it } from "vitest";
import { createSessionSchema } from "@/server/validators/session";

const base = {
  clientId: "c1",
  startsAt: "2026-07-20T10:00",
  durationMinutes: "50",
  location: "OFFICE",
  meetingUrl: "",
  rate: "",
  allowOverlap: null,
};

describe("createSessionSchema", () => {
  it("accepts a plain single session", () => {
    const parsed = createSessionSchema.safeParse({ ...base, recurrence: "NONE" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allowOverlap).toBe(false);
    }
  });

  it("requires occurrences for a recurring series", () => {
    const parsed = createSessionSchema.safeParse({
      ...base,
      recurrence: "WEEKLY",
      occurrences: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("bounds series length to 2-52", () => {
    expect(
      createSessionSchema.safeParse({ ...base, recurrence: "WEEKLY", occurrences: "1" })
        .success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({ ...base, recurrence: "WEEKLY", occurrences: "53" })
        .success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({ ...base, recurrence: "BIWEEKLY", occurrences: "12" })
        .success,
    ).toBe(true);
  });

  it("requires a meeting link for online sessions", () => {
    expect(
      createSessionSchema.safeParse({ ...base, location: "ONLINE", recurrence: "NONE" })
        .success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        ...base,
        location: "ONLINE",
        meetingUrl: "https://zoom.example/1",
        recurrence: "NONE",
      }).success,
    ).toBe(true);
  });

  it("parses the allowOverlap checkbox", () => {
    const parsed = createSessionSchema.safeParse({
      ...base,
      recurrence: "NONE",
      allowOverlap: "on",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.allowOverlap).toBe(true);
  });
});
