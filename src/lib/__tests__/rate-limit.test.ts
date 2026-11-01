import { describe, expect, it, vi } from "vitest";
import { createLimiter, decide, memoryStore, type RateLimitStore } from "@/lib/rate-limit-core";

const WINDOW = { limit: 3, windowMs: 60_000 };
const T0 = 1_800_000_000_000;

describe("rateLimit", () => {
  const limiter = () => createLimiter(memoryStore(), memoryStore());

  it("allows up to the limit and then blocks", async () => {
    const { rateLimit } = limiter();
    for (let i = 0; i < 3; i++) expect((await rateLimit("k", WINDOW, T0)).allowed).toBe(true);
    const blocked = await rateLimit("k", WINDOW, T0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(59_000);
  });

  it("allows again once the window has passed", async () => {
    const { rateLimit } = limiter();
    for (let i = 0; i < 4; i++) await rateLimit("k", WINDOW, T0);
    expect((await rateLimit("k", WINDOW, T0 + 59_999)).allowed).toBe(false);
    expect((await rateLimit("k", WINDOW, T0 + 60_000)).allowed).toBe(true);
  });

  it("blocked tries don't extend the window", async () => {
    const { rateLimit } = limiter();
    for (let i = 0; i < 20; i++) await rateLimit("k", WINDOW, T0 + i * 1000);
    expect((await rateLimit("k", WINDOW, T0 + 60_000)).allowed).toBe(true);
  });

  it("tracks keys independently", async () => {
    const { rateLimit } = limiter();
    for (let i = 0; i < 4; i++) await rateLimit("a", WINDOW, T0);
    expect((await rateLimit("a", WINDOW, T0)).allowed).toBe(false);
    expect((await rateLimit("b", WINDOW, T0)).allowed).toBe(true);
  });
});

describe("allAllowed", () => {
  const FIRST = { limit: 2, windowMs: 60_000 };
  const SHARED = { limit: 4, windowMs: 60_000 };

  it("a refused try doesn't count against the limits after it", async () => {
    const { allAllowed, peek } = createLimiter(memoryStore(), memoryStore());
    const checks: [string, typeof FIRST][] = [
      ["mine", FIRST],
      ["shared", SHARED],
    ];
    for (let i = 0; i < 2; i++) expect(await allAllowed(checks, T0)).toBe(true);
    for (let i = 0; i < 50; i++) expect(await allAllowed(checks, T0)).toBe(false);
    expect((await peek("shared", T0))?.count).toBe(2);
    expect(await allAllowed([["other", FIRST], ["shared", SHARED]], T0)).toBe(true);
  });
});

describe("buckets", () => {
  it("peek doesn't count, and an expired bucket reads as none", async () => {
    const { hit, peek } = createLimiter(memoryStore(), memoryStore());
    await hit("k", 1000, T0);
    expect((await peek("k", T0 + 1))?.count).toBe(1);
    expect((await peek("k", T0 + 1))?.count).toBe(1);
    expect(await peek("k", T0 + 1000)).toBeNull();
  });

  it("clear starts the count over", async () => {
    const { hit, clear, peek } = createLimiter(memoryStore(), memoryStore());
    await hit("k", 1000, T0);
    await clear("k");
    expect(await peek("k", T0)).toBeNull();
  });

  it("decide allows exactly `limit` hits", () => {
    const b = (count: number) => ({ count, expiresAt: T0 + 5000, lastHitAt: T0 });
    expect(decide(b(3), 3, T0).allowed).toBe(true);
    expect(decide(b(4), 3, T0)).toEqual({ allowed: false, retryAfterMs: 5000 });
  });
});

describe("when the database fails", () => {
  const broken: RateLimitStore = {
    hit: async () => {
      throw new Error("down");
    },
    peek: async () => {
      throw new Error("down");
    },
    clear: async () => {
      throw new Error("down");
    },
  };

  it("limits still hold, in memory, and the failure is reported", async () => {
    const onError = vi.fn();
    const { rateLimit } = createLimiter(broken, memoryStore(), onError);
    for (let i = 0; i < 3; i++) expect((await rateLimit("k", WINDOW, T0)).allowed).toBe(true);
    expect((await rateLimit("k", WINDOW, T0)).allowed).toBe(false);
    expect(onError).toHaveBeenCalled();
  });
});
