// Pure rules for "המשך עם Google" (tested in google-auth.test.ts). The DB work
// and the Auth.js wiring live in src/auth.ts.

import type { PendingTwoFactor } from "@/lib/auth-gate";
import { freshSessionClock, type SessionClock } from "@/lib/idle-timeout";

/** Google sign-in is offered only once both keys are configured. */
export function isGoogleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.AUTH_GOOGLE_ID?.trim() && !!env.AUTH_GOOGLE_SECRET?.trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Cookie set when "המשך עם Google" is pressed on the register page with the
 * data-holding agreement ticked. It only records that this browser accepted
 * the agreement a moment ago — creating an account through Google needs it,
 * exactly like the checkbox on the email/password form.
 */
export const GOOGLE_AGREEMENT_COOKIE = "psy_google_agreement";
export const GOOGLE_AGREEMENT_COOKIE_MAX_AGE_S = 15 * 60;

export type GoogleSignInDecision =
  | { type: "reject"; reason: "unverified" | "no-email" }
  | { type: "link"; userId: string }
  | { type: "create"; email: string; name: string }
  | { type: "need-agreement" };

/**
 * What to do with a Google identity. An existing user with that email is
 * always the one signed in (Google proved the address), so an email never
 * gets a second account; a new email becomes a new practice only after the
 * agreement was accepted.
 */
export function decideGoogleSignIn(input: {
  email: string | null | undefined;
  emailVerified: unknown;
  googleName: string | null | undefined;
  existingUserId: string | null;
  agreementAccepted: boolean;
}): GoogleSignInDecision {
  const email = input.email ? normalizeEmail(input.email) : "";
  if (!email || !email.includes("@")) return { type: "reject", reason: "no-email" };
  // Google sends a boolean; be strict — anything but `true` is unverified
  if (input.emailVerified !== true) return { type: "reject", reason: "unverified" };
  if (input.existingUserId) return { type: "link", userId: input.existingUserId };
  if (!input.agreementAccepted) return { type: "need-agreement" };
  return { type: "create", email, name: displayNameFor(input.googleName, email) };
}

/** The account name for a new Google user: Google's name, else the email's local part. */
export function displayNameFor(googleName: string | null | undefined, email: string): string {
  const name = googleName?.trim();
  if (name && name.length >= 2) return name.slice(0, 100);
  const local = email.split("@")[0] ?? "";
  return local.length >= 2 ? local.slice(0, 100) : email.slice(0, 100);
}

export type GoogleTokenUser = {
  id: string;
  name: string;
  email: string;
  totpEnabled: boolean;
  totpSecret: string | null;
  idleTimeoutMinutes?: number;
};

/**
 * The session token minted after a Google sign-in. A user with 2FA on gets a
 * pending token (no `id`) — she's in only after the code at /login/two-factor.
 */
export function tokenForGoogleUser(
  user: GoogleTokenUser,
  now: number,
): {
  sub: string;
  name: string;
  email: string;
  id?: string;
  pending2fa?: PendingTwoFactor;
} & Partial<SessionClock> {
  const base = { sub: user.id, name: user.name, email: user.email };
  if (user.totpEnabled && user.totpSecret) {
    // The idle clock starts when the code is entered (a fresh sign-in token).
    return { ...base, pending2fa: { userId: user.id, since: now } };
  }
  return { ...base, id: user.id, ...freshSessionClock(user.idleTimeoutMinutes, now) };
}
