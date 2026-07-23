// Parses free-text appointment messages (WhatsApp / email, Hebrew-first) into
// structured fields, and matches them against the client list. Pure functions —
// unit tested; `now` is injectable. All dates are clinic wall-clock.

import { CLINIC_TZ } from "@/lib/timezone";

export type ParsedMessage = {
  /** datetime-local string yyyy-MM-ddTHH:mm (clinic wall clock), if found */
  startsAt: string | null;
  dateFound: boolean;
  timeFound: boolean;
  phone: string | null;
  location: "OFFICE" | "ONLINE" | null;
  /** best-effort guess, e.g. from a signature line */
  nameGuess: string | null;
};

export type ClientCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

const WEEKDAYS: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

const MONTHS: Record<string, number> = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Current calendar date in the clinic timezone, as {y, m (0-based), d, weekday}. */
function clinicToday(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CLINIC_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekdayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month) - 1,
    d: Number(parts.day),
    weekday: weekdayIdx,
  };
}

function shiftDate(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `0${digits.slice(3)}`;
  return digits;
}

export function parseAppointmentMessage(text: string, now = new Date()): ParsedMessage {
  const today = clinicToday(now);

  // ── Phone ──
  const phoneMatch = text.match(/(?:\+?972[- ]?|0)5\d(?:[- ]?\d){7}/);
  const phone = phoneMatch ? normalizePhoneDigits(phoneMatch[0]) : null;

  // ── Date ──
  let date: { y: number; m: number; d: number } | null = null;

  // Explicit numeric date: 15/8, 15.8.26, 15/08/2026
  const numDate = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (numDate) {
    const d = Number(numDate[1]);
    const m = Number(numDate[2]) - 1;
    let y = numDate[3] ? Number(numDate[3]) : today.y;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 0 && m <= 11) {
      // No year given and the date already passed → assume next year
      if (!numDate[3] && (m < today.m || (m === today.m && d < today.d))) {
        y += 1;
      }
      date = { y, m, d };
    }
  }

  // Hebrew month name: "15 באוגוסט"
  if (!date) {
    const monthNames = Object.keys(MONTHS).join("|");
    const heDate = text.match(new RegExp(`\\b(\\d{1,2})\\s+ב(${monthNames})`, "u"));
    if (heDate) {
      const d = Number(heDate[1]);
      const m = MONTHS[heDate[2]];
      let y = today.y;
      if (m < today.m || (m === today.m && d < today.d)) y += 1;
      date = { y, m, d };
    }
  }

  // Relative words
  if (!date) {
    if (/מחרתיים/.test(text)) date = shiftDate(today.y, today.m, today.d, 2);
    else if (/מחר/.test(text)) date = shiftDate(today.y, today.m, today.d, 1);
    else if (/היום/.test(text)) date = { y: today.y, m: today.m, d: today.d };
  }

  // Weekday: "ביום שלישי", "יום ה'" → upcoming occurrence
  if (!date) {
    const dayNames = Object.keys(WEEKDAYS).join("|");
    const wd = text.match(new RegExp(`(?:ב?יום\\s+)(${dayNames})`, "u"));
    if (wd) {
      const target = WEEKDAYS[wd[1]];
      let ahead = (target - today.weekday + 7) % 7;
      if (ahead === 0) ahead = 7;
      date = shiftDate(today.y, today.m, today.d, ahead);
    }
  }

  // ── Time ──
  let time: { hh: number; mm: number } | null = null;
  const clockTime = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (clockTime) {
    time = { hh: Number(clockTime[1]), mm: Number(clockTime[2]) };
  } else {
    const bareHour = text.match(/(?:בשעה|ב-?)\s?([01]?\d|2[0-3])\b/);
    if (bareHour) {
      let hh = Number(bareHour[1]);
      // "ב-4" in a therapy context almost always means 16:00, not 04:00
      if (hh >= 1 && hh <= 7) hh += 12;
      time = { hh, mm: 0 };
    }
  }

  // ── Location ──
  let location: "OFFICE" | "ONLINE" | null = null;
  if (/זום|אונליין|online|zoom|מרחוק/i.test(text)) location = "ONLINE";
  else if (/קליניקה|במרפאה/.test(text)) location = "OFFICE";

  // ── Name guess: a short line of Hebrew words with no digits (signature) ──
  let nameGuess: string | null = null;
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of [...lines].reverse()) {
    const clean = line.replace(/[.,!?🙏🙂❤️👍]/gu, "").trim();
    const words = clean.split(/\s+/);
    if (
      words.length >= 1 &&
      words.length <= 3 &&
      /^[֐-׿\s'-]+$/.test(clean) &&
      !/(תודה|שלום|היי|בברכה|להתראות|בבקשה|אשמח|אפשר)/.test(clean)
    ) {
      nameGuess = clean;
      break;
    }
  }

  const startsAt =
    date && time
      ? `${date.y}-${pad(date.m + 1)}-${pad(date.d)}T${pad(time.hh)}:${pad(time.mm)}`
      : date
        ? `${date.y}-${pad(date.m + 1)}-${pad(date.d)}T10:00`
        : null;

  return {
    startsAt,
    dateFound: !!date,
    timeFound: !!time,
    phone,
    location,
    nameGuess,
  };
}

/** Matches parsed message data against the client list. Name-in-text wins, then phone. */
export function matchClient(
  clients: ClientCandidate[],
  text: string,
  parsedPhone: string | null,
): ClientCandidate | null {
  for (const c of clients) {
    const full = `${c.firstName} ${c.lastName}`.trim();
    if (full.length >= 3 && text.includes(full)) return c;
  }
  if (parsedPhone) {
    for (const c of clients) {
      if (c.phone && normalizePhoneDigits(c.phone) === parsedPhone) return c;
    }
  }
  // First name alone (unique match only)
  const byFirst = clients.filter(
    (c) => c.firstName.length >= 2 && text.includes(c.firstName),
  );
  if (byFirst.length === 1) return byFirst[0];
  return null;
}
