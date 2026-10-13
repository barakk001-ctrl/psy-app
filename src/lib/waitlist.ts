// Waiting list ("רשימת המתנה") — pure rules, shared by the clients page and
// the server actions. People here asked for therapy and are waiting for a
// slot; they become clients through the prefilled new-client form.

import { normalizePhoneForWhatsapp } from "@/lib/whatsapp";

export const WAITLIST_NAME_MAX = 120;
export const WAITLIST_PHONE_MAX = 30;
export const WAITLIST_NOTES_MAX = 2000;

/**
 * Splits a full name typed into one field into the new-client form's first
 * and last name: the first word is the first name, the rest the last name
 * ("יעל כהן לוי" → "יעל" + "כהן לוי"). One word → first name only.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };
  return { firstName: words[0], lastName: words.slice(1).join(" ") };
}

/**
 * `tel:` link for a typed phone number — Israeli numbers in international
 * form (+972…), anything else with only its digits (and a leading +).
 * null when there is nothing dialable.
 */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const intl = normalizePhoneForWhatsapp(phone);
  if (intl) return `tel:+${intl}`;
  const digits = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return digits.replace(/\D/g, "").length >= 3 ? `tel:${digits}` : null;
}

/** WhatsApp chat link (no prefilled text), or null for a number it can't read. */
export function whatsappChatHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const intl = normalizePhoneForWhatsapp(phone);
  return intl ? `https://wa.me/${intl}` : null;
}

/** Whole clinic-calendar days between two moments (Asia/Jerusalem dates). */
export function clinicDaysBetween(from: Date, to: Date): number {
  const day = (d: Date) => {
    const [y, m, dd] = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(d)
      .split("-")
      .map(Number);
    return Date.UTC(y, m - 1, dd) / 86_400_000;
  };
  return Math.max(0, day(to) - day(from));
}

/** "ממתין/ה 12 ימים" — how long someone has waited; null on the day they were added. */
export function waitingText(addedAt: Date, now: Date): string | null {
  const days = clinicDaysBetween(addedAt, now);
  if (days === 0) return null;
  if (days === 1) return "ממתין/ה יום אחד";
  return `ממתין/ה ${days} ימים`;
}
