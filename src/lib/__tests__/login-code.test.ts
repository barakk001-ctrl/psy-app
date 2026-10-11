import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_CODE_LIMITS,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_TTL_MS,
  NO_LOGIN_CODE,
  checkLoginCode,
  generateLoginCode,
  hashLoginCode,
  issueLoginCode,
  loginCodeRateKeys,
  normalizeLoginCode,
} from "../login-code";
import { rateLimit } from "../rate-limit";

const SECRET = "test-secret";
const USER = "user_1";
const T0 = Date.UTC(2026, 9, 11, 9, 0);
const ctx = (now = T0) => ({ userId: USER, secret: SECRET, now });

describe("generateLoginCode", () => {
  it("is always 6 digits, keeping leading zeros", () => {
    expect(generateLoginCode(() => 0)).toBe("000000");
    expect(generateLoginCode(() => 42)).toBe("000042");
    expect(generateLoginCode(() => 999_999)).toBe("999999");
  });

  it("draws from the whole 6-digit range", () => {
    const maxes: number[] = [];
    generateLoginCode((max) => {
      maxes.push(max);
      return 0;
    });
    expect(maxes).toEqual([1_000_000]);
  });

  it("uses real randomness by default", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateLoginCode()));
    for (const c of codes) expect(c).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("hashLoginCode", () => {
  it("never stores the digits and depends on account and secret", () => {
    const h = hashLoginCode(USER, "123456", SECRET);
    expect(h).not.toContain("123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLoginCode("user_2", "123456", SECRET)).not.toBe(h);
    expect(hashLoginCode(USER, "123456", "other")).not.toBe(h);
    expect(hashLoginCode(USER, "123456", SECRET)).toBe(h);
  });
});

describe("normalizeLoginCode", () => {
  it("accepts spaces, dashes and phone-keyboard digits", () => {
    expect(normalizeLoginCode(" 123 456 ")).toBe("123456");
    expect(normalizeLoginCode("123-456")).toBe("123456");
    expect(normalizeLoginCode("١٢٣٤٥٦")).toBe("123456");
  });
  it("rejects anything that isn't 6 digits", () => {
    expect(normalizeLoginCode("12345")).toBeNull();
    expect(normalizeLoginCode("1234567")).toBeNull();
    expect(normalizeLoginCode("12a456")).toBeNull();
    expect(normalizeLoginCode("")).toBeNull();
  });
});

describe("checkLoginCode", () => {
  const issued = () => issueLoginCode(USER, SECRET, T0, () => 123_456);

  it("accepts the right code within 10 minutes", () => {
    const { code, stored } = issued();
    expect(code).toBe("123456");
    expect(stored.expiresAt!.getTime()).toBe(T0 + LOGIN_CODE_TTL_MS);
    expect(checkLoginCode(stored, "123456", ctx(T0 + LOGIN_CODE_TTL_MS - 1)).ok).toBe(true);
  });

  it("is single use: a success clears it, so the same code fails next time", () => {
    const { stored } = issued();
    const first = checkLoginCode(stored, "123456", ctx());
    expect(first.ok).toBe(true);
    expect(first.next).toEqual(NO_LOGIN_CODE);
    const second = checkLoginCode(first.next, "123456", ctx());
    expect(second).toMatchObject({ ok: false, reason: "none" });
  });

  it("a newer code replaces the old one", () => {
    const old = issueLoginCode(USER, SECRET, T0, () => 111_111);
    const fresh = issueLoginCode(USER, SECRET, T0 + 1000, () => 222_222);
    expect(checkLoginCode(fresh.stored, old.code, ctx()).ok).toBe(false);
    expect(checkLoginCode(fresh.stored, fresh.code, ctx()).ok).toBe(true);
  });

  it("expires after 10 minutes and is then cleared", () => {
    const { stored } = issued();
    const late = checkLoginCode(stored, "123456", ctx(T0 + LOGIN_CODE_TTL_MS));
    expect(late).toMatchObject({ ok: false, reason: "expired" });
    expect(late.next).toEqual(NO_LOGIN_CODE);
  });

  it("counts wrong codes and throws the code away after the last try", () => {
    let state = issued().stored;
    for (let i = 1; i < LOGIN_CODE_MAX_ATTEMPTS; i++) {
      const r = checkLoginCode(state, "000000", ctx());
      expect(r).toMatchObject({ ok: false, reason: "wrong" });
      expect(r.next.attempts).toBe(i);
      state = r.next;
    }
    const last = checkLoginCode(state, "000000", ctx());
    expect(last).toMatchObject({ ok: false, reason: "wrong" });
    expect(last.next).toEqual(NO_LOGIN_CODE);
    // even the right code is useless now
    expect(checkLoginCode(last.next, "123456", ctx()).ok).toBe(false);
  });

  it("refuses a code already at the try limit", () => {
    const stored = { ...issued().stored, attempts: LOGIN_CODE_MAX_ATTEMPTS };
    expect(checkLoginCode(stored, "123456", ctx())).toMatchObject({ ok: false, reason: "locked" });
  });

  it("only works for the account it was issued to", () => {
    const { stored } = issued();
    expect(checkLoginCode(stored, "123456", { ...ctx(), userId: "user_2" }).ok).toBe(false);
  });

  it("treats garbage input as a wrong try", () => {
    const r = checkLoginCode(issued().stored, "abc", ctx());
    expect(r).toMatchObject({ ok: false, reason: "wrong" });
    expect(r.next.attempts).toBe(1);
  });
});

describe("one-time code rate limits", () => {
  afterEach(() => vi.useRealTimers());

  it("allows 3 codes per email per 15 minutes, then again after the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const limits = LOGIN_CODE_LIMITS.sendPerEmail;
    const key = loginCodeRateKeys("rl-send@example.com", "1.1.1.1").sendPerEmail;
    for (let i = 0; i < limits.limit; i++) expect(rateLimit(key, limits).allowed).toBe(true);
    expect(rateLimit(key, limits).allowed).toBe(false);
    vi.setSystemTime(T0 + limits.windowMs + 1);
    expect(rateLimit(key, limits).allowed).toBe(true);
  });

  it("limits sends per IP across different emails", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const limits = LOGIN_CODE_LIMITS.sendPerIp;
    for (let i = 0; i < limits.limit; i++) {
      const key = loginCodeRateKeys(`rl-ip-${i}@example.com`, "2.2.2.2").sendPerIp;
      expect(rateLimit(key, limits).allowed).toBe(true);
    }
    const key = loginCodeRateKeys("rl-ip-last@example.com", "2.2.2.2").sendPerIp;
    expect(rateLimit(key, limits).allowed).toBe(false);
  });

  it("checks codes against the password login's buckets", () => {
    const keys = loginCodeRateKeys("a@example.com", "3.3.3.3");
    expect(keys.verifyPerEmail).toBe("login:email:a@example.com");
    expect(keys.verifyPerIp).toBe("login:ip:3.3.3.3");
    expect(LOGIN_CODE_LIMITS.verifyPerEmail).toEqual({ limit: 8, windowMs: 15 * 60_000 });
  });
});
