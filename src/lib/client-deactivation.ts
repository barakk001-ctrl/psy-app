// Marking a client "לא פעיל" takes their future meetings off the calendar.
// Pure rules; the server actions (clients.ts) load the meetings and apply them.
//
// It reuses the bulk-delete safety rules (bulk-delete.ts): only meetings that
// start after now, and a meeting holding a note, attachment, payment record,
// app invoice or Morning document number is never deleted — it is kept and set
// CANCELLED (so it leaves the calendar and no reminder goes out). Only meetings
// that are on the calendar are considered: one already cancelled stays as is.

import { planFutureDelete, type BulkDeleteCandidate, type KeepReason } from "./bulk-delete";

export type DeactivationCandidate = BulkDeleteCandidate & { status: string };

export type DeactivationPlan = {
  /** future, on the calendar and empty — deleted */
  deleteIds: string[];
  /** future, SCHEDULED, holding records — kept and set CANCELLED */
  cancelIds: string[];
  /** why each cancelled meeting was kept */
  keep: { id: string; reasons: KeepReason[] }[];
};

export function planDeactivation(
  sessions: DeactivationCandidate[],
  now: Date,
): DeactivationPlan {
  const onCalendar = sessions.filter((s) => s.status !== "CANCELLED");
  const base = planFutureDelete(onCalendar, now);
  const status = new Map(onCalendar.map((s) => [s.id, s.status]));
  // A future meeting already marked done / no-show that holds records keeps its
  // status — it's the practitioner's own record; only booked ones are cancelled.
  const keep = base.keep.filter((k) => status.get(k.id) === "SCHEDULED");
  return { deleteIds: base.deleteIds, cancelIds: keep.map((k) => k.id), keep };
}

/** How many meetings leave the calendar (deleted + cancelled). */
export function deactivationCount(plan: DeactivationPlan): number {
  return plan.deleteIds.length + plan.cancelIds.length;
}

/**
 * Whether switching to inactive must stop and ask first. `confirmed` is the
 * count the practitioner saw and approved (null = not asked yet); if more
 * meetings appeared since, she is asked again rather than surprised.
 */
export function needsDeactivationConfirm(
  plan: DeactivationPlan,
  confirmed: number | null,
): boolean {
  const n = deactivationCount(plan);
  if (n === 0) return false;
  return confirmed === null || n > confirmed;
}

/**
 * The confirmation line, e.g. "יוסרו 8 פגישות עתידיות מהיומן (2 שיש בהן
 * תיעוד/תשלום יישמרו כמבוטלות)." — null when nothing would change.
 */
export function deactivationNotice(plan: DeactivationPlan): string | null {
  const total = deactivationCount(plan);
  if (total === 0) return null;
  const kept = plan.cancelIds.length;
  const head =
    total === 1 ? "תוסר פגישה עתידית אחת מהיומן" : `יוסרו ${total} פגישות עתידיות מהיומן`;
  if (kept === 0) return `${head}.`;
  if (total === 1) return `${head} (יש בה תיעוד/תשלום — היא תישמר כמבוטלת).`;
  const tail =
    kept === 1
      ? "אחת שיש בה תיעוד/תשלום תישמר כמבוטלת"
      : kept === total
        ? "בכולן יש תיעוד/תשלום — הן יישמרו כמבוטלות"
        : `${kept} שיש בהן תיעוד/תשלום יישמרו כמבוטלות`;
  return `${head} (${tail}).`;
}

/**
 * Ends an open-ended (קבוע) series at the meetings it has, so the cron never
 * extends it again — not even if the client is later made active again (she
 * books anew then). "FREQ=WEEKLY;INTERVAL=2" + 7 → "FREQ=WEEKLY;INTERVAL=2;COUNT=7".
 */
export function closeRecurrenceRule(rule: string, memberCount: number): string {
  const base = rule
    .split(";")
    .filter((p) => p && !p.startsWith("COUNT="))
    .join(";");
  return `${base};COUNT=${Math.max(1, memberCount)}`;
}
