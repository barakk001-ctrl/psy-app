// WhatsApp deep links for manual reminders — no API account needed.

/**
 * Normalizes an Israeli phone number to international digits for wa.me.
 * Accepts "050-1234567", "+972 50 123 4567", "972501234567" etc.
 * Returns null when the number can't be recognized.
 */
export function normalizePhoneForWhatsapp(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("972")) {
    return digits.length >= 11 && digits.length <= 12 ? digits : null;
  }
  // Local mobile/landline format: 0XXXXXXXXX
  if (digits.startsWith("0") && (digits.length === 10 || digits.length === 9)) {
    return `972${digits.slice(1)}`;
  }
  return null;
}

export function buildWhatsappUrl(phone: string, text: string): string | null {
  const normalized = normalizePhoneForWhatsapp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

const LOCATION_PHRASES: Record<string, string> = {
  OFFICE: "בקליניקה",
  ONLINE: "אונליין",
  HOME_VISIT: "בביקור בית",
  OTHER: "",
};

export function buildWhatsappReminderText(params: {
  clientFirstName: string;
  startsAt: Date;
  location: string;
  meetingUrl?: string | null;
}): string {
  const date = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(params.startsAt);
  const time = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(params.startsAt);

  const where = LOCATION_PHRASES[params.location] ?? "";
  const lines = [
    `שלום ${params.clientFirstName}, תזכורת לפגישה שלנו ביום ${date} בשעה ${time}${where ? ` ${where}` : ""}.`,
  ];
  if (params.location === "ONLINE" && params.meetingUrl) {
    lines.push(`קישור לפגישה: ${params.meetingUrl}`);
  }
  lines.push("נתראה!");
  return lines.join("\n");
}
