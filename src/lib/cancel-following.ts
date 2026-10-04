// Calendar popup: cancelling a meeting "and all of this client's following
// meetings" (a client who stopped coming — the slot is not held for them).
//
// It is the meeting page's "delete all future meetings of [client]" (rules in
// bulk-delete.ts), started after the cancelled meeting instead of after now:
// - the meeting being edited is kept, marked cancelled (she cancelled it);
// - every meeting of the client that starts after it (and after now) leaves
//   the calendar: empty ones are deleted; ones holding a note, attachment,
//   payment record, app invoice or Morning document are kept and set
//   CANCELLED, so no reminder goes out;
// - meetings between now and the cancelled one, and all past ones, stay.

import { keepReasonsText, type BulkDeletePlan } from "./bulk-delete";

/** Meetings starting after this moment are "following": after the meeting
 *  being cancelled, and never in the past. */
export function followingCutoff(meetingStart: Date, now: Date): Date {
  return new Date(Math.max(meetingStart.getTime(), now.getTime()));
}

export type FollowingCounts = {
  /** empty meetings that will be deleted */
  remove: number;
  /** scheduled meetings holding records — kept and set CANCELLED */
  keep: number;
  /** "סיכום, רישום תשלום" */
  keepReasons: string;
};

export function followingCounts(
  plan: BulkDeletePlan & { scheduledKeepIds: string[] },
  excludeId?: string,
): FollowingCounts {
  const keepIds = new Set(plan.scheduledKeepIds.filter((id) => id !== excludeId));
  return {
    remove: plan.deleteIds.filter((id) => id !== excludeId).length,
    keep: keepIds.size,
    keepReasons: keepReasonsText(plan.keep.filter((k) => keepIds.has(k.id))),
  };
}

export function followingTotal(c: FollowingCounts): number {
  return c.remove + c.keep;
}

/** Shown before saving, e.g. "יוסרו מהיומן עוד 8 הפגישות הבאות של דנה כהן." */
export function cancelFollowingNotice(c: FollowingCounts, clientName: string): string {
  const total = followingTotal(c);
  if (total === 0) return "";
  const head =
    total === 1
      ? `תוסר מהיומן גם הפגישה הבאה של ${clientName}.`
      : `יוסרו מהיומן גם ${total} הפגישות הבאות של ${clientName}.`;
  if (c.keep === 0) return head;
  const kept =
    c.keep === 1
      ? `אחת מהן, שיש בה ${c.keepReasons}, תישאר ברשומה כמבוטלת.`
      : c.keep === total
        ? `בכולן יש ${c.keepReasons} — הן יישארו ברשומה כמבוטלות.`
        : `${c.keep} מהן, שיש בהן ${c.keepReasons}, יישארו ברשומה כמבוטלות.`;
  return `${head} ${kept}`;
}

/** Shown after saving. */
export function cancelFollowingResult(c: FollowingCounts, clientName: string): string {
  const total = followingTotal(c);
  if (total === 0) return "הפגישה בוטלה.";
  const head =
    total === 1
      ? `הפגישה בוטלה, וגם הפגישה הבאה של ${clientName} הוסרה מהיומן`
      : `הפגישה בוטלה, וגם ${total} הפגישות הבאות של ${clientName} הוסרו מהיומן`;
  if (c.keep === 0) return `${head}.`;
  const kept =
    c.keep === total
      ? total === 1
        ? "היא נשמרה ברשומה כמבוטלת"
        : "הן נשמרו ברשומה כמבוטלות"
      : c.keep === 1
        ? "אחת מהן נשמרה ברשומה כמבוטלת"
        : `${c.keep} מהן נשמרו ברשומה כמבוטלות`;
  return `${head} (${kept}).`;
}

/**
 * Whether the save must stop and show the counts again: the practitioner
 * approved `confirmed` meetings (null = she never saw a count); if more are
 * affected now, she is asked again rather than surprised.
 */
export function needsFollowingConfirm(c: FollowingCounts, confirmed: number | null): boolean {
  const n = followingTotal(c);
  if (n === 0) return false;
  return confirmed === null || n > confirmed;
}
