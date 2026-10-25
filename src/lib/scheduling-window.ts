// How far ahead an account may put meetings on the calendar.
//
// During the free trial ("מנוי היכרות") meetings can be booked or moved only up
// to TRIAL_SCHEDULING_DAYS ahead — a rolling window, so a trial can't be used
// to fill a year of calendar and then keep it read-only for free. Recurring
// series of a trial account are generated only inside the window and grow
// with it (the hourly top-up). Paid plans (monthly and yearly) and exempt
// accounts have no limit; an expired account is read-only anyway and gets
// nothing new generated. Nothing already booked is ever removed by this.

import { formatDate } from "@/lib/format";
import { CLINIC_TZ, fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";
import type { SubscriptionState } from "@/lib/subscription";
import type { Slot } from "@/lib/recurrence";

export const TRIAL_SCHEDULING_DAYS = 30;

/**
 * When "all following meetings" move with an edited one, the followers may
 * land this many days past the window: shifting a standing weekly slot to
 * another weekday must always work, even when its last meeting sits near the
 * edge. The edited meeting itself must be inside the window.
 */
export const FOLLOWER_GRACE_DAYS = 7;

export type SchedulingWindow = {
  /** the last clinic calendar day a meeting may be on, "yyyy-MM-dd" */
  lastDay: string;
  /** meetings must start before this instant (the clinic midnight after lastDay) */
  limit: Date;
};

/** Adds whole calendar days to a "yyyy-MM-dd" string (no time zone involved). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The window for this account, or null when it may schedule without a limit. */
export function schedulingWindow(
  state: Pick<SubscriptionState, "status">,
  now: Date = new Date(),
  timeZone = CLINIC_TZ,
): SchedulingWindow | null {
  if (state.status !== "trial") return null;
  const today = toZonedDateTimeLocal(now, timeZone).slice(0, 10);
  const lastDay = addDays(today, TRIAL_SCHEDULING_DAYS);
  return { lastDay, limit: fromZonedDateTimeLocal(`${addDays(lastDay, 1)}T00:00`, timeZone) };
}

/** True when a meeting starting at `startsAt` falls past the window (+ grace days). */
export function beyondWindow(
  startsAt: Date,
  w: SchedulingWindow | null,
  graceDays = 0,
): boolean {
  if (!w) return false;
  const limit = graceDays
    ? w.limit.getTime() + graceDays * 24 * 60 * 60 * 1000
    : w.limit.getTime();
  return startsAt.getTime() >= limit;
}

/** The slots of a new series that fall inside the window (all of them without one). */
export function slotsInWindow<T extends Slot>(slots: T[], w: SchedulingWindow | null): T[] {
  return w ? slots.filter((s) => !beyondWindow(s.startsAt, w)) : slots;
}

/** "24 בנוב׳ 2026" — the last day, as the app writes dates. */
export function windowLastDayText(w: SchedulingWindow): string {
  return formatDate(fromZonedDateTimeLocal(`${w.lastDay}T12:00`));
}

/** The refusal for a single meeting (or a move) past the window. */
export function windowError(w: SchedulingWindow): string {
  return `בתקופת הניסיון אפשר לקבוע פגישות עד ${TRIAL_SCHEDULING_DAYS} יום קדימה — עד ${windowLastDayText(w)}. אחרי רכישת מנוי (״מנוי ומסלולים״ בתפריט) אפשר לקבוע גם רחוק יותר.`;
}

/** The refusal when "all following meetings" would carry some past the window. */
export function followersWindowError(w: SchedulingWindow): string {
  return `${windowError(w)} חלק מהפגישות הבאות יעברו מעבר לטווח — אפשר להזיז רק את הפגישה הזו.`;
}

/** The refusal for a fixed-length series whose meetings run past the window. */
export function seriesWindowError(w: SchedulingWindow, fitting: number): string {
  const alternatives =
    fitting >= 2
      ? `אפשר לבחור ״קבוע — ללא תאריך סיום״ (הפגישות הבאות יתווספו ליומן מעצמן כשהטווח מתקדם), או עד ${fitting} פגישות.`
      : "אפשר לבחור ״קבוע — ללא תאריך סיום״: הפגישות הבאות יתווספו ליומן מעצמן כשהטווח מתקדם.";
  return `בתקופת הניסיון אפשר לקבוע פגישות עד ${TRIAL_SCHEDULING_DAYS} יום קדימה — עד ${windowLastDayText(w)}. ${alternatives}`;
}

/** The note shown under the date field while the window applies. */
export function windowHint(w: SchedulingWindow): string {
  return `בתקופת הניסיון אפשר לקבוע פגישות עד ${TRIAL_SCHEDULING_DAYS} יום קדימה (עד ${windowLastDayText(w)}).`;
}

/**
 * What the hourly top-up may add to an account's open-ended series:
 * "normal" (paid / exempt), "window" (trial — only inside the window) or
 * "none" (expired — nothing new is generated until the account is renewed).
 */
export function topUpPolicy(
  state: Pick<SubscriptionState, "status">,
): "normal" | "window" | "none" {
  if (state.status === "expired") return "none";
  if (state.status === "trial") return "window";
  return "normal";
}

/** What the forms need to limit their date pickers (passed from the server). */
export type WindowUi = { lastDay: string; hint: string };

export function windowUi(w: SchedulingWindow | null): WindowUi | null {
  return w ? { lastDay: w.lastDay, hint: windowHint(w) } : null;
}

/**
 * The `max` for a date / datetime-local input — left off when the value being
 * edited is already past it (booked before the limit existed), so the browser
 * doesn't refuse saving other fields of that meeting.
 */
export function pickerMax(
  ui: WindowUi | null | undefined,
  kind: "date" | "datetime-local",
  current?: string,
): string | undefined {
  if (!ui) return undefined;
  if (current && current.slice(0, 10) > ui.lastDay) return undefined;
  return kind === "date" ? ui.lastDay : `${ui.lastDay}T23:59`;
}
