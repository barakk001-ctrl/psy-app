export type Slot = { startsAt: Date; endsAt: Date };

/**
 * Generates occurrence slots for a recurring series. Dates keep the same
 * wall-clock time across DST changes; interval is in whole weeks.
 */
export function seriesSlots(
  first: Date,
  durationMs: number,
  intervalWeeks: number,
  count: number,
): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(
      first.getFullYear(),
      first.getMonth(),
      first.getDate() + i * intervalWeeks * 7,
      first.getHours(),
      first.getMinutes(),
    );
    slots.push({ startsAt: start, endsAt: new Date(start.getTime() + durationMs) });
  }
  return slots;
}

export function buildRecurrenceRule(intervalWeeks: number, count: number): string {
  return `FREQ=WEEKLY;INTERVAL=${intervalWeeks};COUNT=${count}`;
}
