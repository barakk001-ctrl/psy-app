import { CLINIC_TZ, toZonedDateTimeLocal } from "./timezone";

/** The year the app first went out; the footer's range starts here. */
export const COPYRIGHT_FIRST_YEAR = 2026;

/** "2026", then "2026–2027" etc.: the current clinic-calendar year, computed
 *  at render time so the footer never needs a yearly edit. */
export function copyrightYears(now: Date = new Date(), timeZone = CLINIC_TZ): string {
  const year = Number(toZonedDateTimeLocal(now, timeZone).slice(0, 4));
  return year > COPYRIGHT_FIRST_YEAR ? `${COPYRIGHT_FIRST_YEAR}–${year}` : String(COPYRIGHT_FIRST_YEAR);
}
