import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit and then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    const blocked = rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows again after the window slides", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, { limit: 3, windowMs: 60_000 });
    }
    expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(a, { limit: 3, windowMs: 60_000 });
    expect(rateLimit(a, { limit: 3, windowMs: 60_000 }).allowed).toBe(false);
    expect(rateLimit(b, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
  });
});
