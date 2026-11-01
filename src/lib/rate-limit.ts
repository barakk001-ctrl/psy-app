import crypto from "node:crypto";
import { db } from "@/lib/db";
import { createLimiter, memoryStore, type Bucket, type RateLimitStore } from "@/lib/rate-limit-core";

// Rate limits kept in Postgres (RateLimitBucket), so they survive restarts and
// hold across replicas. Rules: rate-limit-core.ts. Each row's key is an HMAC:
// the table holds no email or IP address. Rows are deleted once expired
// (purgeExpiredRateLimits, hourly maintenance).

function keyHash(key: string): string {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(`rate-limit:${key}`)
    .digest("hex");
}

/** Written as UTC wall-clock text, so the result doesn't depend on the session's time zone. */
const sqlTime = (ms: number) => new Date(ms).toISOString();

type Row = { count: number; expiresAt: Date; lastHitAt: Date };
const toBucket = (r: Row): Bucket => ({
  count: Number(r.count),
  expiresAt: r.expiresAt.getTime(),
  lastHitAt: r.lastHitAt.getTime(),
});

const postgresStore: RateLimitStore = {
  async hit(key, windowMs, now) {
    const k = keyHash(key);
    const at = sqlTime(now);
    const until = sqlTime(now + windowMs);
    // One statement, so concurrent hits on any replica each count exactly once
    const rows = await db.$queryRaw<Row[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "lastHitAt")
      VALUES (${k}, 1, ${until}::text::timestamp, ${at}::text::timestamp)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${at}::text::timestamp
                       THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${at}::text::timestamp
                           THEN ${until}::text::timestamp ELSE "RateLimitBucket"."expiresAt" END,
        "lastHitAt" = ${at}::text::timestamp
      RETURNING "count", "expiresAt", "lastHitAt"`;
    return toBucket(rows[0]);
  },
  async peek(key, now) {
    const row = await db.rateLimitBucket.findUnique({ where: { key: keyHash(key) } });
    return row && row.expiresAt.getTime() > now ? toBucket(row) : null;
  },
  async clear(key) {
    await db.rateLimitBucket.deleteMany({ where: { key: keyHash(key) } });
  },
};

const limiter = createLimiter(postgresStore, memoryStore(), (err) => {
  console.error("[rate-limit] database unavailable, using memory:", err instanceof Error ? err.name : "error");
});

export const rateLimit = limiter.rateLimit;
export const allAllowed = limiter.allAllowed;
export const hitBucket = limiter.hit;
export const peekBucket = limiter.peek;
export const clearBucket = limiter.clear;

export async function purgeExpiredRateLimits(now = new Date()): Promise<number> {
  const { count } = await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}
