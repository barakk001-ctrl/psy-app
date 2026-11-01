// The re-check before the most sensitive account actions (exporting everything,
// closing the account). A signed-in session isn't enough for those: a phone left
// unlocked mustn't be able to take the whole practice's records or delete them.
// Pure rules; the check itself is in reauth-server.ts.

export type ReauthMethod = "totp" | "password" | "email";

/**
 * The strongest thing the account has: the authenticator when 2FA is on, else
 * the password, else (an account opened through Google) a code to its email.
 */
export function reauthMethod(u: {
  totpEnabled: boolean;
  totpSecret?: string | null;
  hashedPassword: string | null;
}): ReauthMethod {
  if (u.totpEnabled && u.totpSecret) return "totp";
  if (u.hashedPassword) return "password";
  return "email";
}

export const REAUTH_LABELS: Record<ReauthMethod, string> = {
  totp: "קוד מאפליקציית האימות (או קוד גיבוי)",
  password: "סיסמת החשבון",
  email: "קוד שנשלח לאימייל",
};

/** Guessing from a signed-in session is still guessing. */
export const REAUTH_LIMIT = { limit: 6, windowMs: 15 * 60_000 };
export const REAUTH_CODE_SEND_LIMIT = { limit: 3, windowMs: 15 * 60_000 };
