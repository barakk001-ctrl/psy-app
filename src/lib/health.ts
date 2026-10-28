// /api/health — what an uptime monitor (and Railway's deploy healthcheck)
// sees. Pure and tested (health.test.ts). The answer is deliberately tiny:
// no versions, hosts, timings, error messages or anything about users.

export type HealthBody = { ok: boolean; db: "ok" | "error" };

export const DB_PING_TIMEOUT_MS = 3000;

/** Runs the ping with a time limit; never throws. */
export async function checkHealth(
  ping: () => Promise<unknown>,
  timeoutMs: number = DB_PING_TIMEOUT_MS,
): Promise<{ status: 200 | 503; body: HealthBody }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return { status: 200, body: { ok: true, db: "ok" } };
  } catch {
    return { status: 503, body: { ok: false, db: "error" } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
