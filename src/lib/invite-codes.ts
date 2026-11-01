// Invite codes: letting one person sign up without touching ALLOWED_EMAILS.
// Pure rules, tested in invite-codes.test.ts; the DB side is invite-store.ts.
// A code is checked on the server when the account is created, and using it
// up happens in the same transaction, so a limited code can't be overused by
// a race and a failed sign-up costs nothing. A code only ever matters while
// sign-up is closed: on the list or under SIGNUP_OPEN it is left unused.

/** No 0/O, 1/I/L, so a code survives being read out or retyped. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 12;

export const INVITE_MAX_USES = 50;

/** Set by the register page's Google button; read after Google's round-trip. */
export const GOOGLE_INVITE_COOKIE = "psy_google_invite";

export const INVITE_INVALID_MESSAGE = "קוד ההזמנה אינו תקף, פג תוקפו או שכבר נוצל.";

/** `randomInt` from node:crypto: this file also runs in the browser (the admin card). */
export function generateInviteCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** What was typed or linked → the code, or null ("1" is the plain ?invite=1 link). */
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== INVITE_CODE_LENGTH) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export type InviteFields = {
  usedCount: number;
  maxUses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export type InviteStatus = "active" | "used" | "expired" | "revoked";

export function inviteStatus(invite: InviteFields, now: number): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedCount >= invite.maxUses) return "used";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now) return "expired";
  return "active";
}

export function inviteUsable(invite: InviteFields, now: number): boolean {
  return inviteStatus(invite, now) === "active";
}

export function inviteExpiry(days: number | null, now: number): Date | null {
  return days ? new Date(now + days * 24 * 60 * 60_000) : null;
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/register?invite=${code}`;
}
