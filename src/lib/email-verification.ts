import crypto from "node:crypto";

// Email verification for email/password sign-ups. Pure rules, tested in
// __tests__/email-verification.test.ts; the DB and email side lives in
// email-verification-store.ts.
//
// An unverified account has no session at all: the password sign-in refuses
// it (after the password was right), so no guard further in has to know about
// this state. The link is one sha256-hashed, single-use token on the User row,
// and confirming it takes the account's password too. That is what stops
// someone from registering another person's address in advance: whoever holds
// the mailbox but not the password goes through "שכחת סיסמה?", which replaces
// the unproven password.

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60_000;

/** src/lib/rate-limit.ts limits for sending a link and for confirming one. */
export const EMAIL_VERIFY_LIMITS = {
  sendPerEmail: { limit: 3, windowMs: 60 * 60_000 },
  sendPerIp: { limit: 10, windowMs: 60 * 60_000 },
  noticePerEmail: { limit: 2, windowMs: 60 * 60_000 },
  confirmPerIp: { limit: 10, windowMs: 15 * 60_000 },
} as const;

export function emailVerifyRateKeys(email: string, ip: string) {
  return {
    sendPerEmail: `verify:send:email:${email}`,
    sendPerIp: `verify:send:ip:${ip}`,
    noticePerEmail: `verify:notice:email:${email}`,
    confirmPerIp: `verify:confirm:ip:${ip}`,
  };
}

export function hashVerifyToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A fresh token to email, and what to store for it (replaces any earlier one). */
export function issueVerifyToken(now: number): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashVerifyToken(token), expiresAt: new Date(now + EMAIL_VERIFY_TTL_MS) };
}

export type RegistrationStep =
  /** sign-up isn't open to this address; same answer whether it has an account or not */
  | "refuse"
  | "create"
  /** the account is waiting for its link: send a new one, change nothing else */
  | "resend-link"
  /** the address already has a working account: tell its owner, change nothing */
  | "notify-owner";

/**
 * What a sign-up does. The visitor gets one answer for the last three, "check
 * your email", so the form never tells whether an address has an account.
 */
export function registrationStep(input: {
  allowed: boolean;
  existing: { emailVerifiedAt: Date | null } | null;
}): RegistrationStep {
  if (!input.allowed) return "refuse";
  if (!input.existing) return "create";
  return input.existing.emailVerifiedAt ? "notify-owner" : "resend-link";
}

/**
 * Google proved the address of an account still waiting for verification. Its
 * password was never proven by anyone, and may be a stranger's who registered
 * the address first, so it goes: the account continues as a Google account
 * (a password can be set later through the email link).
 */
export function googleVerifiedUpdate(now: Date, googleName: string) {
  return {
    name: googleName,
    emailVerifiedAt: now,
    hashedPassword: null,
    emailVerifyTokenHash: null,
    emailVerifyExpiresAt: null,
  };
}
