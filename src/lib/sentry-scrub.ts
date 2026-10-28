// What may leave the app in an error report (Sentry). Pure and tested
// (sentry-scrub.test.ts); used as `beforeSend`/`beforeBreadcrumb` on the
// server and in the browser (src/lib/sentry-options.ts).
//
// The rule: an error report says *where* and *what kind of* error — never
// *whose* data. So every event is rebuilt from an allow-list:
// - request: method + the page type only (ids/tokens → ":id", no query,
//   no body, no cookies, no headers) — bodies can hold a note being saved;
// - no user, no IP, no server name, no `extra`, only technical contexts;
// - exception/message text: first non-empty line only (+ a Prisma error code), capped, with emails, quoted
//   strings and long digit runs (phones, ID numbers) masked — e.g. a Prisma
//   error prints its whole `data: {…}` argument after the first line;
// - stack frames: no local variables (they could hold decrypted note text);
// - breadcrumbs: only navigation and HTTP calls, with sanitised URLs.
// Clinical note content therefore never reaches Sentry: it is not in any
// field we keep, and the text fields we keep are cut to one masked line.

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { sanitizePagePath } from "@/lib/support-request";

const MAX_TEXT = 300;
const KEPT_CONTEXTS = ["runtime", "os", "browser", "device", "trace", "app"];
const KEPT_BREADCRUMBS = new Set(["navigation", "fetch", "xhr", "http"]);

/** One line, masked, capped. */
export function scrubText(raw: string | undefined): string | undefined {
  if (raw == null) return raw;
  // First non-empty line (Prisma errors start with a blank one).
  const first = String(raw).split(/\r?\n/).find((l) => l.trim()) ?? "";
  return first
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/"[^"]*"/g, '"…"')
    .replace(/'[^']*'/g, "'…'")
    .replace(/\d[\d\s-]{5,}\d/g, "[number]")
    .slice(0, MAX_TEXT);
}

/** A URL or path → page type only: "/clients/:id/sessions" (+ origin if absolute). */
export function scrubUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    return u.origin + (sanitizePagePath(u.pathname) ?? "/");
  } catch {
    return sanitizePagePath(raw) ?? undefined;
  }
}

/** "GET /clients/abc123" → "GET /clients/:id"; route patterns ("/clients/[id]") stay. */
function scrubTransaction(name: string | undefined): string | undefined {
  if (!name) return name;
  const m = name.match(/^([A-Z]+ )?(\/\S*)(.*)$/);
  if (!m) return scrubText(name);
  const path = m[2].includes("[") ? m[2].split("?")[0] : sanitizePagePath(m[2]) ?? "/";
  return `${m[1] ?? ""}${path}`;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (!b.category || !KEPT_BREADCRUMBS.has(b.category)) return null;
  const d = b.data ?? {};
  const data: Record<string, unknown> = {};
  if (typeof d.method === "string") data.method = d.method;
  if (typeof d.status_code === "number") data.status_code = d.status_code;
  if (typeof d.url === "string") data.url = scrubUrl(d.url);
  if (typeof d.from === "string") data.from = scrubUrl(d.from);
  if (typeof d.to === "string") data.to = scrubUrl(d.to);
  return { type: b.type, category: b.category, level: b.level, timestamp: b.timestamp, data };
}

/** Prisma's error code (P1001 "can't reach database", P2002 "unique"…), if any. */
function prismaCode(original: unknown): string | null {
  const code = (original as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null;
}

export function scrubEvent<E extends ErrorEvent>(event: E, hint?: { originalException?: unknown }): E {
  const e = event;
  delete e.user;
  delete e.server_name;
  delete e.extra;
  if (e.request) {
    e.request = { method: e.request.method, url: scrubUrl(e.request.url) };
  }
  if (e.contexts) {
    const kept: NonNullable<E["contexts"]> = {};
    for (const k of KEPT_CONTEXTS) if (e.contexts[k]) kept[k] = e.contexts[k];
    e.contexts = kept;
  }
  e.message = scrubText(e.message);
  if (e.logentry) e.logentry = { message: scrubText(e.logentry.message) };
  e.transaction = scrubTransaction(e.transaction);
  for (const ex of e.exception?.values ?? []) {
    ex.value = scrubText(ex.value);
    const code = prismaCode(hint?.originalException);
    if (code && ex === e.exception?.values?.at(-1)) ex.value = `${ex.value ?? ""} [${code}]`.trim();
    for (const f of ex.stacktrace?.frames ?? []) delete f.vars;
  }
  for (const t of e.threads?.values ?? []) {
    for (const f of t.stacktrace?.frames ?? []) delete f.vars;
  }
  if (e.breadcrumbs) {
    e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  }
  return e;
}
