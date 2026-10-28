// "פנייה לתמיכה" — pure rules for the support form in the help widget.
// The server action (src/server/actions/support.ts) wires these to auth, the
// database and the email helper; everything here is testable without either.

import type { SendEmailResult } from "@/lib/email";

/** Where support requests go unless SUPPORT_EMAIL is set on the server. */
export const SUPPORT_FALLBACK_EMAIL = "barakk001@gmail.com";

export function supportRecipient(env: Record<string, string | undefined> = process.env): string {
  const configured = env.SUPPORT_EMAIL?.trim();
  return configured && configured.includes("@") ? configured : SUPPORT_FALLBACK_EMAIL;
}

/** Submissions per user (and per IP) per hour. */
export const SUPPORT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60_000 };

// ── Attachment (an optional screenshot) ──────────────────────────────────────

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENT_LABEL = "5MB";

export const ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

/** For the file input's `accept` attribute. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.join(",");

/**
 * The image type the bytes actually hold, from their signature — the browser's
 * `file.type` is only a hint (it comes from the file name). null = not an
 * image we accept.
 */
export function sniffImageType(bytes: Uint8Array): AttachmentType | null {
  const at = (i: number) => bytes[i];
  const ascii = (from: number, len: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(from, from + len)));
  if (bytes.length >= 8 && at(0) === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return null;
}

export type AttachmentMeta = { name: string; type: string; size: number };

/**
 * The checks that need only the file's name/type/size — run in the browser
 * before uploading and again on the server. null = fine.
 */
export function attachmentMetaError(meta: AttachmentMeta): string | null {
  if (meta.size <= 0) return "הקובץ ריק";
  if (meta.size > MAX_ATTACHMENT_BYTES) {
    return `הקובץ גדול מדי — עד ${MAX_ATTACHMENT_LABEL}`;
  }
  const type = meta.type.toLowerCase();
  // An iPhone sometimes leaves the type empty for HEIC — the bytes decide then
  if (type && !(ATTACHMENT_TYPES as readonly string[]).includes(type)) {
    return "אפשר לצרף רק תמונה (PNG, JPG, WEBP, GIF או HEIC)";
  }
  return null;
}

/** Full server-side check: name/type/size, then the bytes themselves. */
export function checkAttachment(
  meta: AttachmentMeta,
  bytes: Uint8Array,
): { ok: true; type: AttachmentType; name: string } | { ok: false; error: string } {
  const metaError = attachmentMetaError(meta);
  if (metaError) return { ok: false, error: metaError };
  const sniffed = sniffImageType(bytes);
  if (!sniffed) return { ok: false, error: "הקובץ אינו תמונה תקינה" };
  return { ok: true, type: sniffed, name: safeFileName(meta.name, sniffed) };
}

const EXTENSION: Record<AttachmentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** A file name that is safe in an email attachment / download header. */
export function safeFileName(name: string, type: AttachmentType): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, "")
    .trim()
    .slice(0, 80);
  return `${base || "screenshot"}.${EXTENSION[type]}`;
}

// ── Context sent along with the request ─────────────────────────────────────

/**
 * The page the widget was opened on, without record ids — so the request says
 * "a client's card" but never which client. Query strings and hashes are
 * dropped too (they can hold search text).
 */
export function sanitizePagePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/")) return null;
  const segments = path
    .split("/")
    .filter(Boolean)
    .slice(0, 6)
    .map((seg) => (/^[a-z][a-z-]*$/.test(seg) ? seg : ":id"));
  return ("/" + segments.join("/")).slice(0, 120);
}

// ── Saving and emailing ──────────────────────────────────────────────────────

export type SupportSubmitDeps = {
  /** Stores the request; throwing means nothing was saved. */
  save: () => Promise<{ id: string }>;
  /** Emails it to support; may fail or throw. */
  send: (id: string) => Promise<SendEmailResult>;
  /** Records how the email went (best-effort). */
  recordEmail: (id: string, result: SendEmailResult) => Promise<void>;
};

export type SupportSubmitResult = { id: string; emailed: boolean };

/**
 * Save first, then email. The request is kept whatever happens to the email,
 * and the caller learns whether it went out, so the user is told honestly.
 */
export async function submitSupportRequest(deps: SupportSubmitDeps): Promise<SupportSubmitResult> {
  const { id } = await deps.save();
  let result: SendEmailResult;
  try {
    result = await deps.send(id);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    await deps.recordEmail(id, result);
  } catch {
    // the request itself is saved; the status line is best-effort
  }
  return { id, emailed: result.ok };
}

/** Failed emails are retried by the hourly maintenance this many times in total. */
export const MAX_EMAIL_ATTEMPTS = 6;
/** …and only for requests younger than this. */
export const EMAIL_RETRY_WINDOW_MS = 3 * 24 * 60 * 60_000;

export const SUPPORT_SUCCESS_MESSAGE = "הפנייה נשלחה — נחזור עם תשובה בהקדם";
export const SUPPORT_SAVED_NOT_EMAILED_MESSAGE =
  "הפנייה נשמרה אצלנו, אבל שליחת ההודעה במייל לתמיכה נכשלה כרגע. היא לא אבדה — ננסה לשלוח אותה שוב באופן אוטומטי, והתשובה תגיע בהקדם.";
