// Wall-clock ⇄ UTC conversions for the clinic's timezone. The server may run
// in any TZ (Railway is UTC) — never parse datetime-local strings with
// `new Date(str)` on the server; use these helpers instead.

export const CLINIC_TZ = "Asia/Jerusalem";

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/**
 * Parses a datetime-local string ("yyyy-MM-ddTHH:mm") as wall-clock time in
 * the given timezone and returns the corresponding UTC instant.
 */
export function fromZonedDateTimeLocal(value: string, timeZone = CLINIC_TZ): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  // First guess: treat the wall clock as UTC, then correct by the zone offset.
  // Second pass handles instants near a DST transition.
  let utc = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    utc = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

/**
 * Formats a UTC instant as a datetime-local string ("yyyy-MM-ddTHH:mm")
 * showing the wall-clock time in the given timezone.
 */
export function toZonedDateTimeLocal(date: Date, timeZone = CLINIC_TZ): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const hour = String(Number(parts.hour) % 24).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}
