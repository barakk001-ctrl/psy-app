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
