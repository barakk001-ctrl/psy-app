import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  canonicalOrigin,
  originFromHeaders,
  trustedOrigins,
  withPublicOrigin,
} from "@/lib/request-origin";

const prod = {
  APP_URL: "https://mirpaa.app",
  RAILWAY_PUBLIC_DOMAIN: "psy-app-production.up.railway.app",
};

function hdrs(map: Record<string, string>) {
  const h = new Headers(map);
  return { get: (n: string) => h.get(n) };
}

describe("canonicalOrigin", () => {
  it("prefers APP_URL and keeps the origin only", () => {
    expect(canonicalOrigin({ APP_URL: "https://mirpaa.app/", NEXTAUTH_URL: "https://x.y" })).toBe(
      "https://mirpaa.app",
    );
  });
  it("falls back to the Auth.js names", () => {
    expect(canonicalOrigin({ NEXTAUTH_URL: "https://old.example/api" })).toBe("https://old.example");
  });
  it("is null when nothing is set or the value is junk", () => {
    expect(canonicalOrigin({})).toBeNull();
    expect(canonicalOrigin({ APP_URL: "https://" })).toBeNull();
  });
});

describe("trustedOrigins", () => {
  it("lists canonical, extra and Railway origins once each", () => {
    expect(
      trustedOrigins({
        ...prod,
        APP_ALT_ORIGINS: "https://psy-app-production.up.railway.app, https://other.example",
      }),
    ).toEqual([
      "https://mirpaa.app",
      "https://psy-app-production.up.railway.app",
      "https://other.example",
    ]);
  });
});

describe("originFromHeaders", () => {
  it("keeps a trusted host", () => {
    expect(originFromHeaders(hdrs({ host: "mirpaa.app", "x-forwarded-proto": "https" }), prod)).toBe(
      "https://mirpaa.app",
    );
    expect(
      originFromHeaders(
        hdrs({ host: "psy-app-production.up.railway.app", "x-forwarded-proto": "https" }),
        prod,
      ),
    ).toBe("https://psy-app-production.up.railway.app");
  });
  it("prefers x-forwarded-host and takes the first value of a list", () => {
    expect(
      originFromHeaders(
        hdrs({ host: "localhost:8080", "x-forwarded-host": "mirpaa.app, proxy", "x-forwarded-proto": "https,http" }),
        prod,
      ),
    ).toBe("https://mirpaa.app");
  });
  it("sends an unknown host or plain http to the canonical address", () => {
    expect(originFromHeaders(hdrs({ host: "evil.example" }), prod)).toBe("https://mirpaa.app");
    expect(originFromHeaders(hdrs({ host: "mirpaa.app", "x-forwarded-proto": "http" }), prod)).toBe(
      "https://mirpaa.app",
    );
    expect(originFromHeaders(hdrs({}), prod)).toBe("https://mirpaa.app");
  });
  it("uses the request's own host when nothing is configured (dev)", () => {
    expect(originFromHeaders(hdrs({ host: "localhost:3000", "x-forwarded-proto": "http" }), {})).toBe(
      "http://localhost:3000",
    );
  });
});

describe("withPublicOrigin", () => {
  const behindProxy = (host: string) =>
    new NextRequest("http://localhost:8080/api/auth/signin/google?x=1", {
      headers: { host, "x-forwarded-proto": "https" },
    });

  it("moves the URL to the address the request came in on", () => {
    expect(withPublicOrigin(behindProxy("mirpaa.app"), prod).url).toBe(
      "https://mirpaa.app/api/auth/signin/google?x=1",
    );
    expect(withPublicOrigin(behindProxy("psy-app-production.up.railway.app"), prod).nextUrl.origin).toBe(
      "https://psy-app-production.up.railway.app",
    );
  });
  it("keeps headers and method", () => {
    const req = new NextRequest("http://localhost:8080/api/auth/callback/credentials", {
      method: "POST",
      headers: { host: "mirpaa.app", "x-forwarded-proto": "https", cookie: "a=b" },
    });
    const out = withPublicOrigin(req, prod);
    expect(out.method).toBe("POST");
    expect(out.headers.get("cookie")).toBe("a=b");
  });
  it("leaves the request alone when Auth.js pins the origin itself", () => {
    const req = behindProxy("mirpaa.app");
    expect(withPublicOrigin(req, { ...prod, NEXTAUTH_URL: "https://mirpaa.app" })).toBe(req);
  });
});
