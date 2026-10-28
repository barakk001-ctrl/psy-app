// Who may open a new practice (create an account), by email/password or by
// Google. Pure — tested in signup-policy.test.ts; used by registerAction,
// the Google signIn callback (auth.ts), the email change in Settings, and
// the /register and /pricing pages.
//
// One switch, SIGNUP_OPEN:
//   - unset (today): sign-up is by invitation only — a new account can be
//     created only for an address listed in ALLOWED_EMAILS (comma-separated).
//     /register shows the "ההרשמה כרגע בהזמנה בלבד" page, and /pricing's
//     buttons become "בקשת הצטרפות".
//   - SIGNUP_OPEN=true: anyone may sign up (ALLOWED_EMAILS no longer matters).
// Existing users are never affected: signing in matches the User row first,
// so the allowlist only ever applies to *creating* an account.
// In development with no ALLOWED_EMAILS, sign-up stays open (local testing).

import { OPERATOR_EMAIL } from "@/lib/operator";

type Env = Record<string, string | undefined>;

/** Where people ask to join while sign-up is by invitation. */
export const JOIN_REQUEST_EMAIL = OPERATOR_EMAIL;

/** The invite-only message, shown on /register and to a blocked sign-up. */
export const INVITE_ONLY_MESSAGE = `ההרשמה כרגע בהזמנה בלבד. לבקשת הצטרפות: ${JOIN_REQUEST_EMAIL}`;

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** SIGNUP_OPEN=true (or 1/yes) opens sign-up to everyone. */
export function signupOpen(env: Env = process.env): boolean {
  return /^(true|1|yes)$/i.test(env.SIGNUP_OPEN?.trim() ?? "");
}

/** Whether a new account may be created for this (already lower-cased) email. */
export function canCreateAccount(email: string, env: Env = process.env): boolean {
  if (signupOpen(env)) return true;
  const list = parseAllowlist(env.ALLOWED_EMAILS);
  if (list.length > 0) return list.includes(email.trim().toLowerCase());
  // No allowlist: open in development, closed in production
  return env.NODE_ENV !== "production";
}

/**
 * Whether the public pages show the invitation-only state (the /register
 * notice, "בקשת הצטרפות" on /pricing) instead of an open sign-up form.
 */
export function inviteOnly(env: Env = process.env): boolean {
  if (signupOpen(env)) return false;
  return env.NODE_ENV === "production" || parseAllowlist(env.ALLOWED_EMAILS).length > 0;
}
