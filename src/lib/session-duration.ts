/** Meeting lengths offered in the duration pickers.
 *
 *  50 minutes is the common "therapeutic hour", but practices differ — 45 and
 *  30 are both normal — so the list is only a convenience and the practitioner's
 *  own default is what the form opens on.
 */
export const DURATION_CHOICES = [30, 45, 50, 60, 75, 90, 120] as const;

/** The choices, plus `minutes` if it is not already one of them.
 *
 *  A practitioner who typed an unusual length must still see it selected rather
 *  than silently snapped to the nearest option, which would change bookings
 *  without anyone noticing.
 */
export function withDuration(
  choices: readonly number[],
  minutes: number | null | undefined,
): number[] {
  const list = [...choices];
  if (minutes && !list.includes(minutes)) {
    list.push(minutes);
    list.sort((a, b) => a - b);
  }
  return list;
}

export const DEFAULT_SESSION_MINUTES = 50;

/** "HH:MM" plus some minutes, as "HH:MM" on the same day.
 *
 *  Moving a meeting's start carries its end along by the practitioner's default
 *  length, so a 15:00 → 16:00 move lands on 16:50 instead of leaving the end at
 *  15:50, before the start. A meeting cannot run past midnight, so the end stops
 *  at 23:59 rather than wrapping round to the early morning.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const total = Math.min(Number(m[1]) * 60 + Number(m[2]) + minutes, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
