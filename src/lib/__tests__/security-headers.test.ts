import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, permissionsPolicy, securityHeaders } from "@/lib/security-headers";
import { blockedSource, createLogBudget, cspLogLine, parseCspReports } from "@/lib/csp-report";

const header = (name: string, opts = {}) =>
  securityHeaders(opts).find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

const directive = (csp: string, name: string) =>
  csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " "));

describe("securityHeaders", () => {
  it("sends HSTS for a year with subdomains, never preload", () => {
    const v = header("Strict-Transport-Security")!;
    expect(v).toContain("max-age=31536000");
    expect(v).toContain("includeSubDomains");
    expect(v).not.toContain("preload");
  });

  it("forbids framing twice: X-Frame-Options and an enforced frame-ancestors", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("sends nosniff and the referrer policy", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("keeps the full CSP report-only", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy-Report-Only");
    expect(header("Reporting-Endpoints")).toBe('csp="/api/csp-report"');
  });
});

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy();

  it("allows only our own scripts (plus Next's inline bootstrap), no eval in production", () => {
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("covers the logo data: URL, blob previews and self-hosted fonts", () => {
    expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob:");
    expect(directive(csp, "font-src")).toContain("'self'");
  });

  it("lets forms lead to Google sign-in and the Grow payment page only", () => {
    const fa = directive(csp, "form-action")!;
    expect(fa).toContain("'self'");
    expect(fa).toContain("https://accounts.google.com");
    expect(fa).toContain("https://secure.meshulam.co.il");
  });

  it("blocks plugins and foreign base URLs, reports to our endpoint", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "report-uri")).toBe("report-uri /api/csp-report");
  });

  it("allows only Sentry's EU ingest besides our own origin for connections", () => {
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://*.ingest.de.sentry.io");
  });
});

describe("permissionsPolicy", () => {
  const pp = permissionsPolicy();
  it("keeps Face ID, the share sheet and the clipboard for our origin", () => {
    expect(pp).toContain("publickey-credentials-get=(self)");
    expect(pp).toContain("publickey-credentials-create=(self)");
    expect(pp).toContain("web-share=(self)");
    expect(pp).toContain("clipboard-write=(self)");
  });
  it("switches off what the app never uses", () => {
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });
});

describe("parseCspReports", () => {
  it("reads the report-uri shape and keeps only origin + page type", () => {
    const out = parseCspReports({
      "csp-report": {
        "document-uri": "https://mirpaa.app/clients/cmabc123xyz/sessions?tab=notes",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?secret=1",
        "script-sample": "alert('client name')",
      },
    });
    expect(out).toEqual([
      { directive: "script-src-elem", blocked: "https://evil.example", page: "/clients/:id/sessions" },
    ]);
    expect(cspLogLine(out[0])).not.toContain("client name");
  });

  it("reads the Reporting API shape and hides /request tokens", () => {
    const out = parseCspReports([
      { type: "csp-violation", body: { documentURL: "https://mirpaa.app/request/Ab12Cd34", effectiveDirective: "style-src-attr", blockedURL: "inline" } },
      { type: "deprecation", body: {} },
    ]);
    expect(out).toEqual([{ directive: "style-src-attr", blocked: "inline", page: "/request/:id" }]);
  });

  it("ignores junk", () => {
    expect(parseCspReports(null)).toEqual([]);
    expect(parseCspReports("x")).toEqual([]);
    expect(parseCspReports({ foo: 1 })).toEqual([]);
  });

  it("names data:/blob: sources by scheme", () => {
    expect(blockedSource("data:image/png;base64,AAAA")).toBe("data");
    expect(blockedSource("blob:https://mirpaa.app/123")).toBe("blob");
    expect(blockedSource("eval")).toBe("eval");
    expect(blockedSource("<script>")).toBe("other");
  });
});

describe("createLogBudget", () => {
  it("allows `limit` lines per window, then resets", () => {
    let t = 0;
    const allow = createLogBudget(2, 1000, () => t);
    expect([allow(), allow(), allow()]).toEqual([true, true, false]);
    t = 1000;
    expect(allow()).toBe(true);
  });
});
