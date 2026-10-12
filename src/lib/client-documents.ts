// Documents uploaded to a client's file ("מסמכים" on the client card) —
// referral letters, assessments, consent and insurance forms, scans. Pure
// rules, shared by the browser (a first check before uploading) and the
// server (the real one). Storage is in document-storage.ts, the actions in
// server/actions/client-documents.ts, serving in client-document-serve.ts.

import { sniffImageType } from "@/lib/support-request";

// ── Limits ──────────────────────────────────────────────────────────────────

/** Per file. The server-action body limit in next.config.ts must stay above it. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_DOCUMENT_LABEL = "15MB";
/** Files picked or dropped at once. */
export const MAX_DOCUMENTS_PER_BATCH = 20;
export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_NAME_LENGTH = 120;

// ── Types ───────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const EXTENSIONS: Record<DocumentType, string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/heic": ["heic"],
  "image/heif": ["heif", "heic"],
};

export const ALLOWED_EXTENSIONS = [...new Set(Object.values(EXTENSIONS).flat())];

/**
 * For the file input's `accept`. Extensions as well as MIME types: an iPhone
 * picking from Files sometimes reports no type at all, and Windows often
 * reports none for .heic.
 */
export const DOCUMENT_ACCEPT = [...ALLOWED_EXTENSIONS.map((e) => `.${e}`), ...DOCUMENT_TYPES].join(",");

/** "PDF, Word (DOC/DOCX), JPG, PNG או HEIC" — for the UI. */
export const ALLOWED_TYPES_LABEL = "PDF, Word (DOC/DOCX), JPG, PNG או HEIC";

export type DocumentKind = "pdf" | "word" | "image";

export function documentKind(mimeType: string): DocumentKind {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "word";
}

/** Short label shown next to the icon. */
export function documentTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "application/msword":
      return "DOC";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "image/jpeg":
      return "JPG";
    case "image/png":
      return "PNG";
    case "image/heic":
    case "image/heif":
      return "HEIC";
    default:
      return "קובץ";
  }
}

/**
 * Opened in the browser (Content-Disposition: inline) only for types a browser
 * shows without running anything: PDF and images. Word files always download.
 */
export function canViewInline(mimeType: string): boolean {
  return documentKind(mimeType) !== "word" && (DOCUMENT_TYPES as readonly string[]).includes(mimeType);
}

// ── Categories ──────────────────────────────────────────────────────────────

export const DOCUMENT_CATEGORIES = ["REFERRAL", "ASSESSMENT", "CONSENT", "INSURANCE", "OTHER"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  REFERRAL: "הפניה",
  ASSESSMENT: "אבחון",
  CONSENT: "טופס הסכמה",
  INSURANCE: "טופס ביטוח",
  OTHER: "אחר",
};

/** A category from a form field; anything unknown (or empty) = none. */
export function parseCategory(raw: unknown): DocumentCategory | null {
  return typeof raw === "string" && (DOCUMENT_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as DocumentCategory)
    : null;
}

// ── Sniffing the bytes ──────────────────────────────────────────────────────

const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, sig: number[], at = 0): boolean {
  if (bytes.length < at + sig.length) return false;
  return sig.every((b, i) => bytes[at + i] === b);
}

/** Whether the ASCII text occurs anywhere in the bytes. */
function containsAscii(bytes: Uint8Array, text: string): boolean {
  const needle = Array.from(text, (c) => c.charCodeAt(0));
  const last = bytes.length - needle.length;
  outer: for (let i = 0; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * What the bytes actually are — the browser's type and the file's extension
 * are only claims. null = not a document we accept.
 *
 * - PDF: "%PDF-" within the first 1024 bytes (the spec allows leading junk).
 * - DOCX: a ZIP holding word/document.xml (entry names are stored
 *   uncompressed); one holding a macro project (word/vbaProject.bin — a
 *   .docm renamed) is refused.
 * - DOC: the OLE2 compound-file signature. Excel/PowerPoint 97 files share
 *   it; harmless, they're stored encrypted and only ever downloaded.
 * - JPG/PNG/HEIC: the same signatures as the support form's screenshots.
 */
export function sniffDocumentType(bytes: Uint8Array): DocumentType | null {
  const head = bytes.subarray(0, 1024);
  if (containsAscii(head, "%PDF-")) return "application/pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (!containsAscii(bytes, "word/document.xml")) return null;
    if (containsAscii(bytes, "vbaProject.bin")) return null;
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (startsWith(bytes, OLE2)) return "application/msword";
  const image = sniffImageType(bytes);
  if (image === "image/jpeg" || image === "image/png" || image === "image/heic" || image === "image/heif") {
    return image;
  }
  return null;
}

// ── Checks ──────────────────────────────────────────────────────────────────

export type DocumentMeta = { name: string; size: number };

function extensionOf(name: string): string | null {
  const m = /\.([^./\\]+)$/.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * The checks that need only the name and size — run in the browser before
 * uploading (so a 40MB video isn't sent just to be refused) and again on the
 * server. A name with no extension is left to the bytes. null = fine.
 */
export function documentMetaError(meta: DocumentMeta): string | null {
  if (meta.size <= 0) return "הקובץ ריק";
  if (meta.size > MAX_DOCUMENT_BYTES) return `הקובץ גדול מדי — עד ${MAX_DOCUMENT_LABEL} לקובץ`;
  const ext = extensionOf(meta.name);
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `סוג קובץ שאינו נתמך — אפשר להעלות ${ALLOWED_TYPES_LABEL}`;
  }
  return null;
}

/** Full server-side check: name and size, then the bytes themselves. */
export function checkDocument(
  meta: DocumentMeta,
  bytes: Uint8Array,
): { ok: true; mimeType: DocumentType; name: string } | { ok: false; error: string } {
  const metaError = documentMetaError(meta);
  if (metaError) return { ok: false, error: metaError };
  if (bytes.length !== meta.size) return { ok: false, error: "הקובץ לא הגיע במלואו — נסו שוב" };
  const mimeType = sniffDocumentType(bytes);
  if (!mimeType) {
    return { ok: false, error: `הקובץ אינו ${ALLOWED_TYPES_LABEL} תקין` };
  }
  return { ok: true, mimeType, name: documentFileName(meta.name, mimeType) };
}

// ── Names ───────────────────────────────────────────────────────────────────

/** The name without its extension, cleaned for display and download headers. */
export function cleanBaseName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * The stored name: the file's own name (Hebrew kept) with the extension that
 * matches what the bytes are — "הפניה.docx" holding an old .doc becomes
 * "הפניה.doc", so the download opens in the right program.
 */
export function documentFileName(name: string, mimeType: DocumentType): string {
  const allowed = EXTENSIONS[mimeType];
  const ext = extensionOf(name);
  const keepExt = ext && allowed.includes(ext) ? ext : allowed[0];
  return `${cleanBaseName(name) || "מסמך"}.${keepExt}`;
}

/** A rename: the new base name, keeping the stored file's extension. null = empty. */
export function renamedFileName(newName: string, currentName: string): string | null {
  const ext = extensionOf(currentName);
  const typedExt = extensionOf(newName);
  // Typing "מכתב.pdf" for a PDF shouldn't make "מכתב.pdf.pdf"
  const base = cleanBaseName(typedExt && typedExt === ext ? newName : `${newName}.x`);
  if (!base) return null;
  return ext ? `${base}.${ext}` : base;
}

export function cleanDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, MAX_DESCRIPTION_LENGTH) : null;
}

// ── Display ─────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Download headers ────────────────────────────────────────────────────────

/**
 * Content-Disposition with the Hebrew name (RFC 5987 `filename*`) and an ASCII
 * fallback for old clients. `inline` only where canViewInline allows it.
 */
export function contentDisposition(fileName: string, mimeType: string, wantInline: boolean): string {
  const disposition = wantInline && canViewInline(mimeType) ? "inline" : "attachment";
  const ext = extensionOf(fileName);
  // A name that isn't plain ASCII (Hebrew) falls back to "document.<ext>"
  const plain = /^[\x20-\x7e]+$/.test(fileName) && !/["\\;]/.test(fileName);
  const fallback = plain ? fileName : `document${ext ? `.${ext}` : ""}`;
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Headers for serving a stored document's bytes. */
export function documentResponseHeaders(
  doc: { fileName: string; mimeType: string; size: number },
  wantInline: boolean,
): Record<string, string> {
  return {
    "Content-Type": doc.mimeType,
    "Content-Length": String(doc.size),
    "Content-Disposition": contentDisposition(doc.fileName, doc.mimeType, wantInline),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    // Only sniffed PDF/image/Word bytes are ever served, with nosniff, so
    // nothing can run as a page. (No CSP `sandbox`: it stops Chrome's PDF viewer.)
    "Referrer-Policy": "no-referrer",
  };
}
