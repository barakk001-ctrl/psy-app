// Which hours the calendar's week and day views show. The month view fits the
// screen whole; the hourly grid only does if it doesn't show the whole day,
// so it shows the hours that hold meetings in the visible days — with an hour
// of room either side (to tap an empty slot or drag a meeting next to them)
// and never fewer than MIN_SPAN_HOURS. Empty days show the usual working day.

export const DEFAULT_FIRST_HOUR = 8;
export const DEFAULT_LAST_HOUR = 21;
export const MIN_SPAN_HOURS = 8;
const PAD_HOURS = 1;
const EARLIEST = 0;
const LATEST = 24;

/** A meeting as minutes from the start of its (browser-local) day. */
export type DayMinutes = { start: number; end: number };

export type HourRange = { first: number; last: number };

export function hourRange(meetings: DayMinutes[]): HourRange {
  if (meetings.length === 0) return { first: DEFAULT_FIRST_HOUR, last: DEFAULT_LAST_HOUR };

  const earliest = Math.min(...meetings.map((m) => m.start));
  // A meeting running past midnight counts to the end of the day
  const latest = Math.max(...meetings.map((m) => (m.end <= m.start ? 24 * 60 : m.end)));

  let first = Math.max(EARLIEST, Math.floor(earliest / 60) - PAD_HOURS);
  let last = Math.min(LATEST, Math.ceil(latest / 60) + PAD_HOURS);

  // Widen a short range evenly (more room after it — evening bookings are
  // likelier than dawn ones), staying inside the day
  const missing = MIN_SPAN_HOURS - (last - first);
  if (missing > 0) {
    first -= Math.floor(missing / 2);
    last += Math.ceil(missing / 2);
    if (first < EARLIEST) {
      last += EARLIEST - first;
      first = EARLIEST;
    }
    if (last > LATEST) {
      first -= last - LATEST;
      last = LATEST;
    }
  }
  return { first, last };
}

/** "08:00:00" — FullCalendar's slotMinTime / slotMaxTime format. */
export function slotTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00:00`;
}

/** Minutes since local midnight of a Date (the browser's zone, as FullCalendar draws). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
