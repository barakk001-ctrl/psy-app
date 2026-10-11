import crypto from "node:crypto";

// Sign-in with a one-time code ("כניסה עם קוד חד פעמי"). Pure rules, tested
// in __tests__/login-code.test.ts; the DB side lives in login-code-store.ts.
//
// One live code per account, kept on the User row as an HMAC (never the
// digits themselves): 6 digits, valid LOGIN_CODE_TTL_MS, single use, and at
// most LOGIN_CODE_MAX_ATTEMPTS wrong tries before it is thrown away.

export const LOGIN_CODE_LENGTH = 6;
export const LOGIN_CODE_TTL_MS = 10 * 60_000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

/** Rate limits (src/lib/rate-limit.ts keys). The code check itself shares the
 *  password login's buckets, so switching method buys an attacker nothing. */
export const LOGIN_CODE_LIMITS = {
  sendPerEmail: { limit: 3, windowMs: 15 * 60_000 },
  sendPerIp: { limit: 10, windowMs: 60 * 60_000 },
  verifyPerEmail: { limit: 8, windowMs: 15 * 60_000 },
  verifyPerIp: { limit: 25, windowMs: 15 * 60_000 },
} as const;

export function loginCodeRateKeys(email: string, ip: string) {
  return {
    sendPerEmail: `login-code:send:email:${email}`,
    sendPerIp: `login-code:send:ip:${ip}`,
    // Same buckets as the password login (loginAction / auth.ts)
    verifyPerEmail: `login:email:${email}`,
    verifyPerIp: `login:ip:${ip}`,
  };
}

/** A uniformly random 6-digit code, leading zeros kept ("042917"). */
export function generateLoginCode(randomInt: (max: number) => number = crypto.randomInt): string {
  return String(randomInt(10 ** LOGIN_CODE_LENGTH)).padStart(LOGIN_CODE_LENGTH, "0");
}

/** HMAC of the code, bound to the account, keyed by the server secret: a
 *  database copy alone can't be brute-forced back to the digits. */
export function hashLoginCode(userId: string, code: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`login-code:${userId}:${code}`).digest("hex");
}

/** What was typed → the 6 digits, or null. Accepts spaces/dashes and
 *  Arabic-Indic or Persian digits from a phone keyboard. */
export function normalizeLoginCode(input: string): string | null {
  const digits = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-–]/g, "");
  return new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`).test(digits) ? digits : null;
}

export type StoredLoginCode = {
  hash: string | null;
  expiresAt: Date | null;
  attempts: number;
};

export const NO_LOGIN_CODE: StoredLoginCode = { hash: null, expiresAt: null, attempts: 0 };

/** A fresh code to store (replaces any earlier one). */
export function issueLoginCode(
  userId: string,
  secret: string,
  now: number,
  randomInt?: (max: number) => number,
): { code: string; stored: StoredLoginCode } {
  const code = generateLoginCode(randomInt);
  return {
    code,
    stored: { hash: hashLoginCode(userId, code, secret), expiresAt: new Date(now + LOGIN_CODE_TTL_MS), attempts: 0 },
  };
}

export type LoginCodeCheck =
  | { ok: true; next: StoredLoginCode }
  | { ok: false; reason: "none" | "expired" | "locked" | "wrong"; next: StoredLoginCode };

/**
 * Checks a typed code against the stored one and says what to store next:
 * cleared after a success (single use) or once expired / out of tries, the
 * try counter raised after a wrong code.
 */
export function checkLoginCode(
  stored: StoredLoginCode,
  input: string,
  ctx: { userId: string; secret: string; now: number },
): LoginCodeCheck {
  if (!stored.hash || !stored.expiresAt) return { ok: false, reason: "none", next: NO_LOGIN_CODE };
  if (stored.expiresAt.getTime() <= ctx.now) return { ok: false, reason: "expired", next: NO_LOGIN_CODE };
  if (stored.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false, reason: "locked", next: NO_LOGIN_CODE };

  const code = normalizeLoginCode(input);
  const typed = code ? hashLoginCode(ctx.userId, code, ctx.secret) : "";
  const matches =
    typed.length === stored.hash.length &&
    crypto.timingSafeEqual(Buffer.from(typed), Buffer.from(stored.hash));
  if (matches) return { ok: true, next: NO_LOGIN_CODE };

  const attempts = stored.attempts + 1;
  return {
    ok: false,
    reason: "wrong",
    next: attempts >= LOGIN_CODE_MAX_ATTEMPTS ? NO_LOGIN_CODE : { ...stored, attempts },
  };
}
