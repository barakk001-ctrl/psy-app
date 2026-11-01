// Temporary lockout after repeated failed password logins. Pure rules, tested
// in login-lockout.test.ts; the store is login-lockout-store.ts.
//
// Failures are counted per typed address in a rate-limit bucket, for any
// address, registered or not, so a lockout says nothing about whether an
// account exists. From LOCK_AFTER failures, every further failure locks the
// password for a while, longer as they pile up, capped at an hour. It only ever
// stops the password: the one-time code, the reset link and Google each have
// their own limits, and a success on any of them clears the count. So an
// attacker can keep a password locked but cannot keep the owner out.

export const LOGIN_LIMITS = {
  perEmail: { limit: 8, windowMs: 15 * 60_000 },
  perIp: { limit: 25, windowMs: 15 * 60_000 },
} as const;

/** The count starts over a day after the first failure. */
export const FAILURE_WINDOW_MS = 24 * 60 * 60_000;
export const LOCK_AFTER = 8;

const MINUTE = 60_000;

export function loginLockKey(email: string): string {
  return `login:failures:${email}`;
}

/** The per-address counters of the password login: the form's and the callback's. */
export function loginPasswordKeys(email: string): string[] {
  return [loginLockKey(email), `login:email:${email}`, `login-auth:email:${email}`];
}

/** How long a run of failures locks the password. */
export function lockoutMs(failures: number): number {
  if (failures < LOCK_AFTER) return 0;
  if (failures < 2 * LOCK_AFTER) return 15 * MINUTE;
  if (failures < 3 * LOCK_AFTER) return 30 * MINUTE;
  return 60 * MINUTE;
}

/** Whether a failure bucket currently locks the password. */
export function isLocked(bucket: { count: number; lastHitAt: number } | null, now: number): boolean {
  if (!bucket) return false;
  return now < bucket.lastHitAt + lockoutMs(bucket.count);
}

export const LOGIN_LOCKED_MESSAGE =
  "יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות, או היכנסו עם קוד חד פעמי או דרך ״שכחת סיסמה?״.";
