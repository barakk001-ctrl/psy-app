// HTTP security headers for every response (next.config.ts `headers()`).
// Pure and tested (security-headers.test.ts). Kept in one place so the policy
// can be read — and tightened — without digging through the Next config.
//
// What the browser really loads (checked 2026-10-28):
// - scripts: only our own bundles from /_next/static, plus the inline
//   `self.__next_f.push(...)` scripts Next's App Router writes into every page
//   (that is why script-src needs 'unsafe-inline' until we move to nonces);
// - styles: our CSS + inline style attributes (React `style`, next/font);
// - fonts: next/font/google self-hosts Rubik/Assistant under /_next/static/media;
// - images: our files, data: URLs (the practice logo is stored as one) and
//   blob: URLs (the support form's screenshot preview, PDF previews);
// - media: /explainer.mp4;
// - connections: same origin only (server actions, /api/auth/session, files);
//   plus Sentry's EU ingest host when browser error reporting is switched on;
// - no third-party script at all — Google sign-in and Grow payments are full
//   page redirects started by a form/server action, so they only matter to
//   form-action. Resend and morning are called from the server, never the browser.

export type SecurityHeaderOptions = {
  /** `next dev` needs eval for React Refresh; production never does. */
  dev?: boolean;
  /** Where browsers send CSP violation reports (report-only mode). */
  reportPath?: string;
};

export const CSP_REPORT_PATH = "/api/csp-report";

/** Origins a form submission may end up at (redirects after POST count). */
const FORM_TARGETS = [
  "https://accounts.google.com", // "המשך עם Google"
  "https://secure.meshulam.co.il", // Grow card payment page
  "https://sandbox.meshulam.co.il",
];

/** Sentry's EU (Frankfurt) ingest hosts, e.g. o123.ingest.de.sentry.io. */
const SENTRY_EU_INGEST = "https://*.ingest.de.sentry.io";

/** The full policy, sent as Content-Security-Policy-Report-Only. */
export function contentSecurityPolicy(opts: SecurityHeaderOptions = {}): string {
  const reportPath = opts.reportPath ?? CSP_REPORT_PATH;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(opts.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'", SENTRY_EU_INGEST, ...(opts.dev ? ["ws:"] : [])],
    "frame-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...FORM_TARGETS],
    "frame-ancestors": ["'none'"],
    "report-uri": [reportPath],
    "report-to": ["csp"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Browser features the app may use. Everything the app touches is allowed for
 * our own origin only; the rest is switched off, also for any embedded frame.
 * - publickey-credentials-get/-create: Face ID / Touch ID lock (lib/biometric.ts)
 * - web-share: PDFs and documents go to the iPhone share sheet (pdf-button.tsx)
 * - clipboard-read/-write: "הדבקה" in message import, copy buttons in Settings
 * - fullscreen / picture-in-picture / autoplay: the explainer video
 * Camera is off: document uploads use the file picker, which the policy
 * doesn't govern (on iPhone it still offers "צלם תמונה").
 */
export function permissionsPolicy(): string {
  const self = ["publickey-credentials-get", "publickey-credentials-create", "web-share",
    "clipboard-read", "clipboard-write", "fullscreen", "picture-in-picture", "autoplay"];
  const none = ["camera", "microphone", "geolocation", "payment", "usb", "serial", "bluetooth",
    "hid", "midi", "magnetometer", "gyroscope", "accelerometer", "display-capture",
    "browsing-topics"];
  return [...self.map((f) => `${f}=(self)`), ...none.map((f) => `${f}=()`)].join(", ");
}

/** All headers, in the shape next.config.ts `headers()` wants. */
export function securityHeaders(opts: SecurityHeaderOptions = {}): { key: string; value: string }[] {
  const reportPath = opts.reportPath ?? CSP_REPORT_PATH;
  return [
    // A year, every subdomain. No `preload`: that is hard to undo.
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    // Enforced on its own: browsers ignore frame-ancestors in a report-only policy.
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(opts) },
    { key: "Reporting-Endpoints", value: `csp="${reportPath}"` },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy() },
  ];
}
