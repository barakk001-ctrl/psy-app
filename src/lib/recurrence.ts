import { CLINIC_TZ, fromZonedDateTimeLocal } from "@/lib/timezone";

export type Slot = { startsAt: Date; endsAt: Date };

/**
 * Generates occurrence slots for a recurring series from a datetime-local
 * string ("yyyy-MM-ddTHH:mm"). Occurrences keep the same wall-clock time in
 * the clinic timezone across DST changes; interval is in whole weeks.
 */
export function seriesSlots(
  firstLocal: string,
  durationMs: number,
  intervalWeeks: number,
  count: number,
  timeZone = CLINIC_TZ,
): Slot[] {
  const [datePart, timePart = "00:00"] = firstLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    // Date arithmetic in pure calendar terms, then wall-clock → UTC per occurrence
    const shifted = new Date(Date.UTC(y, m - 1, d + i * intervalWeeks * 7));
    const local = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
      shifted.getUTCDate(),
    )}T${timePart}`;
    const startsAt = fromZonedDateTimeLocal(local, timeZone);
    slots.push({ startsAt, endsAt: new Date(startsAt.getTime() + durationMs) });
  }
  return slots;
}

/** Without `count` the rule is open-ended (קבוע) — the cron keeps extending it. */
export function buildRecurrenceRule(intervalWeeks: number, count?: number): string {
  const base = `FREQ=WEEKLY;INTERVAL=${intervalWeeks}`;
  return count ? `${base};COUNT=${count}` : base;
}

export function isOpenEndedRule(rule: string | null | undefined): boolean {
  return !!rule && !rule.includes("COUNT=");
}

export function ruleInterval(rule: string): number {
  const m = rule.match(/INTERVAL=(\d+)/);
  return m ? Number(m[1]) : 1;
}

/** How many instances to create/maintain ahead for an open-ended series. */
export const OPEN_ENDED_BATCH = 26;

/** Extend an open-ended series when less than this much of it lies ahead. */
export const TOPUP_HORIZON_MS = 8 * 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the cron should append meetings to a series now. Only open-ended
 * (קבוע) series of an ACTIVE client that still have a booked future meeting
 * and are running out (last meeting within the horizon). A series with no
 * future SCHEDULED meeting was ended deliberately (deleted / client left) —
 * never resurrect it; an inactive client's series never grows.
 */
export function shouldTopUpSeries(
  s: {
    recurrenceRule: string | null;
    clientStatus: string;
    aliveFutureCount: number;
    lastStartsAt: Date | null;
  },
  now: Date,
): boolean {
  if (!isOpenEndedRule(s.recurrenceRule)) return false;
  if (s.clientStatus !== "ACTIVE") return false;
  if (s.aliveFutureCount === 0) return false;
  if (!s.lastStartsAt) return false;
  return s.lastStartsAt.getTime() - now.getTime() <= TOPUP_HORIZON_MS;
}
