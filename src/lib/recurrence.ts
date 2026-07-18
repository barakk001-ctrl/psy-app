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

export function buildRecurrenceRule(intervalWeeks: number, count: number): string {
  return `FREQ=WEEKLY;INTERVAL=${intervalWeeks};COUNT=${count}`;
}
