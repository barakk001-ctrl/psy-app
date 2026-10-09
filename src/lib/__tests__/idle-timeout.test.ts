import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_SESSION_MS,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_WARNING_MS,
  SERVER_IDLE_GRACE_MS,
  SESSION_MAX_AGE_SECONDS,
  checkSessionClock,
  clientAbsoluteDeadline,
  formatCountdown,
  freshSessionClock,
  idlePhase,
  idleTimeoutLabel,
  normalizeIdleTimeout,
  refreshTokenClock,
} from "@/lib/idle-timeout";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 9, 8, 0);

describe("normalizeIdleTimeout", () => {
  it("accepts only the offered options", () => {
    expect(normalizeIdleTimeout(15)).toBe(15);
    expect(normalizeIdleTimeout(60)).toBe(60);
    expect(normalizeIdleTimeout("30")).toBe(30);
  });

  it("falls back to 30 minutes for anything else", () => {
    expect(DEFAULT_IDLE_TIMEOUT_MINUTES).toBe(30);
    for (const v of [undefined, null, 0, 45, 600, "abc", -15, Number.NaN]) {
      expect(normalizeIdleTimeout(v)).toBe(30);
    }
  });
});

describe("session cookie lifetime", () => {
  it("covers the longest timeout plus the grace", () => {
    expect(SESSION_MAX_AGE_SECONDS * 1000).toBe(60 * MIN + SERVER_IDLE_GRACE_MS);
  });
});

describe("checkSessionClock (server)", () => {
  const clock = freshSessionClock(30, T0);

  it("refreshes lastSeen on a request within the window", () => {
    const r = checkSessionClock(clock, T0 + 20 * MIN);
    expect(r).toEqual({ ok: true, authTime: T0, lastSeen: T0 + 20 * MIN, idleMinutes: 30 });
  });

  it("allows the grace on top of the timeout, then ends the session", () => {
    expect(checkSessionClock(clock, T0 + 30 * MIN + SERVER_IDLE_GRACE_MS).ok).toBe(true);
    expect(checkSessionClock(clock, T0 + 30 * MIN + SERVER_IDLE_GRACE_MS + 1)).toEqual({
      ok: false,
      reason: "idle",
    });
  });

  it("a laptop asleep for hours comes back signed out", () => {
    expect(checkSessionClock(clock, T0 + 5 * 60 * MIN)).toEqual({ ok: false, reason: "idle" });
  });

  it("uses the token's own timeout", () => {
    const short = freshSessionClock(15, T0);
    expect(checkSessionClock(short, T0 + 25 * MIN).ok).toBe(false);
    const long = freshSessionClock(60, T0);
    expect(checkSessionClock(long, T0 + 60 * MIN).ok).toBe(true);
  });

  it("ends a session 12 hours after sign-in even while active", () => {
    const active = { ...clock, lastSeen: T0 + 12 * 60 * MIN };
    expect(checkSessionClock(active, T0 + ABSOLUTE_SESSION_MS).ok).toBe(true);
    expect(checkSessionClock(active, T0 + ABSOLUTE_SESSION_MS + 1)).toEqual({
      ok: false,
      reason: "absolute",
    });
  });

  it("starts the clock of a token issued before the feature, instead of signing out mid-use", () => {
    expect(checkSessionClock({}, T0)).toEqual({ ok: true, authTime: T0, lastSeen: T0, idleMinutes: 30 });
    expect(checkSessionClock({ authTime: "x", lastSeen: null }, T0).ok).toBe(true);
  });

  it("a clock from the future never extends the session", () => {
    const r = checkSessionClock({ authTime: T0 + 99 * MIN, lastSeen: T0 + 99 * MIN, idleMinutes: 30 }, T0);
    expect(r).toEqual({ ok: true, authTime: T0, lastSeen: T0, idleMinutes: 30 });
  });
});

describe("refreshTokenClock (the jwt callback)", () => {
  const token = { id: "u1", email: "k@example.com", ...freshSessionClock(30, T0) };

  it("keeps the rest of the token and moves lastSeen", () => {
    expect(refreshTokenClock(token, T0 + MIN)).toEqual({ ...token, lastSeen: T0 + MIN });
  });

  it("returns null once expired (Auth.js then clears the cookie)", () => {
    expect(refreshTokenClock(token, T0 + 3 * 60 * MIN)).toBeNull();
  });

  it("takes a valid idleMinutes from a session update", () => {
    expect(refreshTokenClock(token, T0 + MIN, { idleMinutes: 15 })?.idleMinutes).toBe(15);
  });

  it("ignores anything else in an update", () => {
    const r = refreshTokenClock(token, T0 + MIN, {
      idleMinutes: 100_000,
      id: "someone-else",
      authTime: T0 + 999 * MIN,
    });
    expect(r).toEqual({ ...token, lastSeen: T0 + MIN });
  });

  it("an update cannot touch a 2FA-pending token", () => {
    const pending = { pending2fa: { userId: "u1", since: T0 }, ...freshSessionClock(30, T0) };
    const r = refreshTokenClock(pending, T0 + MIN, { idleMinutes: 60 });
    expect(r?.idleMinutes).toBe(30);
    expect(r?.pending2fa).toEqual(pending.pending2fa);
  });
});

describe("idlePhase (browser)", () => {
  const base = { lastActivity: T0, idleMinutes: 30, absoluteDeadline: null };

  it("is active until the warning window", () => {
    expect(idlePhase({ ...base, now: T0 + 27 * MIN })).toEqual({ kind: "active" });
  });

  it("warns two minutes before, with the time left", () => {
    expect(IDLE_WARNING_MS).toBe(2 * MIN);
    expect(idlePhase({ ...base, now: T0 + 28 * MIN + 15_000 })).toEqual({
      kind: "warning",
      reason: "idle",
      msLeft: MIN + 45_000,
    });
  });

  it("expires at the timeout", () => {
    expect(idlePhase({ ...base, now: T0 + 30 * MIN })).toEqual({ kind: "expired", reason: "idle" });
  });

  it("the 12-hour limit wins when it comes first", () => {
    const absoluteDeadline = T0 + 10 * MIN;
    expect(idlePhase({ ...base, absoluteDeadline, now: T0 + 9 * MIN })).toEqual({
      kind: "warning",
      reason: "absolute",
      msLeft: MIN,
    });
    expect(idlePhase({ ...base, absoluteDeadline, now: T0 + 10 * MIN })).toEqual({
      kind: "expired",
      reason: "absolute",
    });
  });

  it("the idle timeout wins when it comes first", () => {
    const p = idlePhase({ ...base, absoluteDeadline: T0 + 60 * MIN, now: T0 + 29 * MIN });
    expect(p).toMatchObject({ kind: "warning", reason: "idle" });
  });
});

describe("formatCountdown / idleTimeoutLabel", () => {
  it("shows minutes and seconds, rounded up", () => {
    expect(formatCountdown(2 * MIN)).toBe("2:00");
    expect(formatCountdown(MIN + 4_500)).toBe("1:05");
    expect(formatCountdown(200)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("labels the options in Hebrew", () => {
    expect(idleTimeoutLabel(15)).toBe("15 דקות");
    expect(idleTimeoutLabel(30)).toBe("30 דקות");
    expect(idleTimeoutLabel(60)).toBe("שעה");
  });
});

describe("clientAbsoluteDeadline", () => {
  it("signs out a minute before the server would, so a summary can still be saved", () => {
    expect(clientAbsoluteDeadline(T0)).toBe(T0 + ABSOLUTE_SESSION_MS - MIN);
    expect(clientAbsoluteDeadline(null)).toBeNull();
    expect(clientAbsoluteDeadline(undefined)).toBeNull();
  });
});
