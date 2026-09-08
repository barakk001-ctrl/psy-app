// iCalendar (ICS) feed generation for the Google Calendar subscription.
// Pure functions — tested without a DB.

export type IcsSession = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  treatmentType: string;
  location: string;
  clientFirstName: string;
  clientLastName: string;
};

export type CalendarNameMode = "FIRST" | "FULL" | "NONE";

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC timestamp in ICS basic format: 20260908T191500Z */
export function icsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape per RFC 5545: backslash, semicolon, comma, newline. */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function eventTitle(s: IcsSession, mode: CalendarNameMode): string {
  const name =
    mode === "FULL"
      ? `${s.clientFirstName} ${s.clientLastName}`.trim()
      : mode === "FIRST"
        ? s.clientFirstName
        : "";
  const base = name ? `פגישה — ${name}` : "פגישה";
  return s.status === "CANCELLED" ? `[בוטלה] ${base}` : base;
}

export function buildIcs(sessions: IcsSession[], mode: CalendarNameMode): string {
  const now = icsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//merapa-ishit//calendar-feed//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:מרפאה אישית",
    "X-WR-TIMEZONE:Asia/Jerusalem",
  ];
  for (const s of sessions) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@merapa-ishit`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(s.startsAt)}`,
      `DTEND:${icsDate(s.endsAt)}`,
      `SUMMARY:${icsEscape(eventTitle(s, mode))}`,
      `DESCRIPTION:${icsEscape(s.treatmentType)}`,
      ...(s.status === "CANCELLED" ? ["STATUS:CANCELLED"] : []),
      ...(s.location === "ONLINE" ? ["LOCATION:אונליין"] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF line endings
  return lines.join("\r\n") + "\r\n";
}
