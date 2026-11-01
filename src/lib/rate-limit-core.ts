// Fixed-window rate limiting. Pure logic and the in-memory store, tested in
// rate-limit.test.ts; src/lib/rate-limit.ts binds it to Postgres. A bucket
// counts hits from the first one until its window ends, then starts over.

export type RateLimitOptions = { limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export type Bucket = { count: number; expiresAt: number; lastHitAt: number };

export interface RateLimitStore {
  /** Counts one hit atomically and returns the bucket as it now stands. */
  hit(key: string, windowMs: number, now: number): Promise<Bucket>;
  /** The live bucket, without counting; null if none or expired. */
  peek(key: string, now: number): Promise<Bucket | null>;
  clear(key: string): Promise<void>;
}

export function decide(bucket: Bucket, limit: number, now: number): RateLimitResult {
  return bucket.count <= limit
    ? { allowed: true, retryAfterMs: 0 }
    : { allowed: false, retryAfterMs: Math.max(bucket.expiresAt - now, 0) };
}

const MAX_BUCKETS = 10_000;

/** One process's memory: the stand-in when Postgres can't be reached. */
export function memoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  return {
    async hit(key, windowMs, now) {
      // So the map can't grow without bound under scanning
      if (buckets.size > MAX_BUCKETS) {
        for (const [k, b] of buckets) if (b.expiresAt <= now) buckets.delete(k);
      }
      const live = buckets.get(key);
      const bucket =
        live && live.expiresAt > now
          ? { ...live, count: live.count + 1, lastHitAt: now }
          : { count: 1, expiresAt: now + windowMs, lastHitAt: now };
      buckets.set(key, bucket);
      return bucket;
    },
    async peek(key, now) {
      const live = buckets.get(key);
      return live && live.expiresAt > now ? live : null;
    },
    async clear(key) {
      buckets.delete(key);
    },
  };
}

/**
 * Limits through `primary`, falling back to `fallback` when it fails: a broken
 * database must neither lift every limit nor take sign-in down with it.
 */
export function createLimiter(
  primary: RateLimitStore,
  fallback: RateLimitStore,
  onError: (err: unknown) => void = () => {},
) {
  async function attempt<T>(run: (store: RateLimitStore) => Promise<T>): Promise<T> {
    try {
      return await run(primary);
    } catch (err) {
      onError(err);
      return run(fallback);
    }
  }
  async function rateLimit(
    key: string,
    { limit, windowMs }: RateLimitOptions,
    now = Date.now(),
  ): Promise<RateLimitResult> {
    return decide(await attempt((s) => s.hit(key, windowMs, now)), limit, now);
  }
  return {
    hit: (key: string, windowMs: number, now = Date.now()) => attempt((s) => s.hit(key, windowMs, now)),
    peek: (key: string, now = Date.now()) => attempt((s) => s.peek(key, now)),
    clear: (key: string) => attempt((s) => s.clear(key)),
    rateLimit,
    /**
     * Several limits in order, stopping at the first refusal, so a refused try
     * never counts against the limits after it. Put the visitor's own limits
     * (IP, address + IP) first: a stranger then can't run up a shared one.
     */
    async allAllowed(checks: [string, RateLimitOptions][], now = Date.now()): Promise<boolean> {
      for (const [key, options] of checks) {
        if (!(await rateLimit(key, options, now)).allowed) return false;
      }
      return true;
    },
  };
}
