// "This meeting only" vs "all of this client's following meetings": which
// meetings belong to a client's standing slot, and where they go when the slot
// moves. Pure — the server actions load candidates and apply the result.
//
// A standing slot is matched on the CLINIC wall clock (weekday + start time in
// Asia/Jerusalem), never on UTC: an 18:00 meeting is 15:00Z in summer and
// 16:00Z in winter, and both are the same Monday-18:00 slot.

import { CLINIC_TZ, fromZonedDateTimeLocal, toZonedDateTimeLocal } from "@/lib/timezone";

export type WallClock = {
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

export function wallClock(d: Date, timeZone = CLINIC_TZ): WallClock {
  const local = toZonedDateTimeLocal(d, timeZone);
  const date = local.slice(0, 10);
  return {
    date,
    time: local.slice(11, 16),
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
  };
}

const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "ימי שני ב-18:00" — the standing slot a meeting sits in, for the UI. */
export function slotLabel(d: Date, timeZone = CLINIC_TZ): string {
  const w = wallClock(d, timeZone);
  return `ימי ${WEEKDAYS_HE[w.weekday]} ב-${w.time}`;
}

/** The id that ties a recurring series together, or null for a lone meeting. */
export function seriesRootOf(s: {
  id: string;
  parentSessionId: string | null;
  recurrenceRule: string | null;
}): string | null {
  return s.parentSessionId ?? (s.recurrenceRule ? s.id : null);
}

export type SlotCandidate = {
  id: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  seriesRootId: string | null;
};

export type SlotAnchor = {
  id: string;
  clientId: string;
  /** the meeting's start BEFORE the edit */
  startsAt: Date;
  seriesRootId: string | null;
};

/**
 * The meetings that move together with `anchor` when "all following meetings
 * of this client" is chosen: the same client's SCHEDULED meetings that start
 * after both the anchor and `now`, and that sit in the anchor's standing slot
 * (same clinic weekday and start time) or belong to the same recurring series.
 * Past, cancelled, completed and one-off meetings at other times never move.
 */
export function standingSlotFollowers<T extends SlotCandidate>(
  anchor: SlotAnchor,
  candidates: T[],
  now: Date,
  timeZone = CLINIC_TZ,
): T[] {
  const slot = wallClock(anchor.startsAt, timeZone);
  const after = Math.max(anchor.startsAt.getTime(), now.getTime());
  return candidates
    .filter((c) => {
      if (c.id === anchor.id) return false;
      if (c.clientId !== anchor.clientId) return false;
      if (c.status !== "SCHEDULED") return false;
      if (c.startsAt.getTime() <= after) return false;
      if (anchor.seriesRootId && c.seriesRootId === anchor.seriesRootId) return true;
      const own = wallClock(c.startsAt, timeZone);
      return own.weekday === slot.weekday && own.time === slot.time;
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Whole calendar days from one yyyy-MM-dd to another (may be negative). */
export function dayOffset(fromDate: string, toDate: string): number {
  return Math.round(
    (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000,
  );
}

/** yyyy-MM-dd plus whole days, as calendar arithmetic. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export type MovedSlot = { id: string; startsAt: Date; endsAt: Date };

/**
 * New times for the followers when the anchor moves from `anchorOldStart` to
 * `newDate` at `newStartTime` (clinic wall clock), lasting `durationMinutes`.
 * Each follower shifts by the same number of days as the anchor did (Monday →
 * Wednesday moves every following Monday to its Wednesday) and takes the new
 * start time; the wall-clock time holds across DST changes.
 */
export function moveFollowers(
  followers: { id: string; startsAt: Date }[],
  anchorOldStart: Date,
  newDate: string,
  newStartTime: string,
  durationMinutes: number,
  timeZone = CLINIC_TZ,
): MovedSlot[] {
  const delta = dayOffset(wallClock(anchorOldStart, timeZone).date, newDate);
  return followers.map((f) => {
    const date = addDays(wallClock(f.startsAt, timeZone).date, delta);
    const startsAt = fromZonedDateTimeLocal(`${date}T${newStartTime}`, timeZone);
    return {
      id: f.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
    };
  });
}
