// Simple in-memory sliding-window rate limiter.
// Sufficient for a single-instance deployment (Railway/self-hosted single node);
// swap for a Redis/DB-backed store if the app ever runs multiple instances.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Opportunistic cleanup so the map can't grow unbounded under scanning
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.timestamps.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.timestamps[0];
    return { allowed: false, retryAfterMs: oldest + windowMs - now };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}
