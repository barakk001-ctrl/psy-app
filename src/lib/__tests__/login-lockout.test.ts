import { describe, expect, it } from "vitest";
import { FAILURE_WINDOW_MS, LOCK_AFTER, isLocked, lockoutMs, loginLockKey, loginPasswordKeys } from "@/lib/login-lockout";
import { LOGIN_CODE_LIMITS, loginCodeRateKeys } from "@/lib/login-code";

const MIN = 60_000;
const T0 = 1_800_000_000_000;

describe("lockoutMs", () => {
  it("nothing before LOCK_AFTER failures", () => {
    expect(lockoutMs(LOCK_AFTER - 1)).toBe(0);
  });

  it("grows with repeated failures and is capped at an hour", () => {
    expect(lockoutMs(LOCK_AFTER)).toBe(15 * MIN);
    expect(lockoutMs(2 * LOCK_AFTER)).toBe(30 * MIN);
    expect(lockoutMs(3 * LOCK_AFTER)).toBe(60 * MIN);
    expect(lockoutMs(100_000)).toBe(60 * MIN);
  });
});

describe("isLocked", () => {
  it("no bucket, no lock", () => {
    expect(isLocked(null, T0)).toBe(false);
  });

  it("locks from the last failure, and only for a while", () => {
    const bucket = { count: LOCK_AFTER, lastHitAt: T0 };
    expect(isLocked(bucket, T0 + 15 * MIN - 1)).toBe(true);
    expect(isLocked(bucket, T0 + 15 * MIN)).toBe(false);
  });

  it("is never permanent: the worst case ends within an hour of the last failure", () => {
    expect(isLocked({ count: 1_000_000, lastHitAt: T0 }, T0 + 60 * MIN)).toBe(false);
  });

  it("the count itself lasts a day", () => {
    expect(FAILURE_WINDOW_MS).toBe(24 * 60 * MIN);
  });
});

describe("clearing after a success", () => {
  it("covers every per-address counter the password login checks", () => {
    expect(loginPasswordKeys("a@example.com")).toEqual([
      loginLockKey("a@example.com"),
      "login:email:a@example.com",
      "login-auth:email:a@example.com",
    ]);
  });
});

describe("a stranger can't use up the ways back in", () => {
  it("the code check doesn't share the password's per-address bucket", () => {
    const keys = loginCodeRateKeys("a@example.com", "3.3.3.3");
    expect(keys.verifyPerEmail).not.toBe("login:email:a@example.com");
    expect(keys.verifyPerIp).toBe("login:ip:3.3.3.3");
  });

  it("one IP can't reach the per-address ceiling on code sends", () => {
    expect(LOGIN_CODE_LIMITS.sendPerEmail.limit).toBeGreaterThan(LOGIN_CODE_LIMITS.sendPerIp.limit);
    expect(LOGIN_CODE_LIMITS.sendPerEmail.windowMs).toBe(LOGIN_CODE_LIMITS.sendPerIp.windowMs);
  });

  it("sends are limited per address and IP together", () => {
    const a = loginCodeRateKeys("a@example.com", "1.1.1.1").sendPerEmailIp;
    expect(loginCodeRateKeys("a@example.com", "2.2.2.2").sendPerEmailIp).not.toBe(a);
    expect(LOGIN_CODE_LIMITS.sendPerEmailIp).toEqual({ limit: 3, windowMs: 15 * MIN });
  });
});
