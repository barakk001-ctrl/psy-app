// Turns a browser's CSP violation report (report-only mode) into one short,
// harmless log line. Pure and tested (csp-report.test.ts).
//
// Browsers send two shapes:
// - `report-uri` (Safari, Firefox): {"csp-report": {"document-uri", "violated-directive",
//   "effective-directive", "blocked-uri", ...}}, content type application/csp-report;
// - Reporting API (`report-to`, Chrome): [{type: "csp-violation", body: {documentURL,
//   effectiveDirective, blockedURL, ...}}], content type application/reports+json.
//
// What is kept: the directive, the blocked resource's origin (or keyword such
// as "inline"/"eval") and the page *type* (ids/tokens replaced, query dropped
// — /request/<token> links are secrets). Nothing else from the report (no
// script samples, no full URLs, no IP or user agent) is logged.

import { sanitizePagePath } from "@/lib/support-request";

export type CspViolation = { directive: string; blocked: string; page: string | null };

const MAX_REPORTS = 20;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** The origin of a URL, or a short keyword ("inline", "eval", "data", …). */
export function blockedSource(raw: string): string {
  const v = raw.trim();
  if (!v) return "unknown";
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ws:" || u.protocol === "wss:") {
      return u.origin;
    }
    return u.protocol.replace(/:$/, ""); // data, blob, chrome-extension…
  } catch {
    // keywords: inline, eval, wasm-eval, trusted-types-policy, self…
    return /^[a-z-]{1,40}$/i.test(v) ? v.toLowerCase() : "other";
  }
}

function pagePath(raw: string): string | null {
  try {
    return sanitizePagePath(new URL(raw).pathname);
  } catch {
    return sanitizePagePath(raw);
  }
}

function directiveName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  return /^[a-z-]{1,40}$/.test(first) ? first : "unknown";
}

function fromLegacy(r: Record<string, unknown>): CspViolation {
  return {
    directive: directiveName(str(r["effective-directive"]) || str(r["violated-directive"])),
    blocked: blockedSource(str(r["blocked-uri"])),
    page: pagePath(str(r["document-uri"])),
  };
}

function fromReportingApi(body: Record<string, unknown>): CspViolation {
  return {
    directive: directiveName(str(body.effectiveDirective) || str(body.violatedDirective)),
    blocked: blockedSource(str(body.blockedURL)),
    page: pagePath(str(body.documentURL)),
  };
}

/** Parses either report shape; anything unrecognised yields no violations. */
export function parseCspReports(payload: unknown): CspViolation[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) {
    return payload
      .slice(0, MAX_REPORTS)
      .filter((r): r is { type: string; body: Record<string, unknown> } =>
        !!r && typeof r === "object" && r.type === "csp-violation" && !!r.body && typeof r.body === "object")
      .map((r) => fromReportingApi(r.body));
  }
  const legacy = (payload as Record<string, unknown>)["csp-report"];
  if (legacy && typeof legacy === "object") return [fromLegacy(legacy as Record<string, unknown>)];
  return [];
}

export function cspLogLine(v: CspViolation): string {
  return `[csp] report-only violation: directive=${v.directive} blocked=${v.blocked} page=${v.page ?? "-"}`;
}

/** At most `limit` log lines per window, so a noisy page (or anyone POSTing
 *  junk) can't flood the logs. */
export function createLogBudget(limit: number, windowMs: number, now: () => number = Date.now) {
  let start = now();
  let used = 0;
  return (): boolean => {
    const t = now();
    if (t - start >= windowMs) {
      start = t;
      used = 0;
    }
    if (used >= limit) return false;
    used++;
    return true;
  };
}
