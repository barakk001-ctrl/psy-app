// Closing an account: pure rules. The DB side is account-closure-data.ts, the
// actions are in server/actions/account.ts.
//
// - Closing is only ever something the therapist does herself, in Settings,
//   with a re-check, a typed phrase and the retention warning. Nothing else sets
//   `closedAt`: not an expired subscription, not a job, not the operator.
//   Expiry leaves an account read-only for good; it never leads to deletion.
// - A closed account can't be worked in, for CLOSURE_GRACE_DAYS. During those
//   days its owner can sign in, restore it as it was, or download everything.
// - After that the hourly job deletes all of that user's data for good.
// - The operator's own account can't be closed from the app.

export const CLOSURE_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What has to be typed to confirm. */
export const CLOSE_CONFIRM_PHRASE = "סגירת החשבון";

/** Spacing and a stray final mark don't matter; the words do. */
export function confirmationMatches(typed: string): boolean {
  return typed.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "") === CLOSE_CONFIRM_PHRASE;
}

/** When a closure made now becomes permanent. */
export function purgeDate(closedAt: Date): Date {
  return new Date(closedAt.getTime() + CLOSURE_GRACE_DAYS * DAY_MS);
}

/** Whole days left to restore (0 = it goes on the next run). */
export function closureDaysLeft(purgeAfter: Date, now: Date): number {
  const left = purgeAfter.getTime() - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / DAY_MS);
}

export type ClosureState = {
  closedAt: Date | null;
  purgeAfter: Date | null;
  isAdmin: boolean;
};

/**
 * The only rule that lets an account be deleted: its owner closed it, and the
 * grace period is over. Subscription state is deliberately not an input.
 */
export function isAccountPurgeDue(u: ClosureState, now: Date): boolean {
  if (u.isAdmin || !u.closedAt || !u.purgeAfter) return false;
  return u.purgeAfter.getTime() <= now.getTime();
}

/** Closed, and the owner can still bring it back. */
export function canRestore(u: Pick<ClosureState, "closedAt" | "purgeAfter">, now: Date): boolean {
  return !!u.closedAt && !!u.purgeAfter && u.purgeAfter.getTime() > now.getTime();
}

/** Why this account can't be closed now, or null. */
export function closureRefusal(u: Pick<ClosureState, "closedAt" | "isAdmin">): string | null {
  if (u.isAdmin) return "חשבון המפעיל לא נסגר מכאן";
  if (u.closedAt) return "החשבון כבר סגור";
  return null;
}

export const CLOSURE_WARNING =
  "חובות שמירת הרשומות הטיפוליות ומסמכי המס נשארות באחריותך גם אחרי סגירת החשבון, לפי הנחיות משרד הבריאות, כללי האתיקה והוראות ניהול הספרים. לכן לפני הסגירה מורידים עותק מלא ושומרים אותו במקום מאובטח.";

export const CLOSURE_ACK_TEXT = "קראתי, והבנתי שחובות שמירת הרשומות והמסמכים נשארות באחריותי";
