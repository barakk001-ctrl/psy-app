import { describe, expect, it } from "vitest";
import {
  PENDING_2FA_MAX_AGE_MS,
  TWO_FACTOR_PATH,
  gateRequest,
  resolveAuthState,
  sessionForToken,
} from "@/lib/auth-gate";

const NOW = 1_800_000_000_000;
const baseSession = {
  user: { name: "קרן", email: "keren@example.com", image: null },
  expires: "2026-10-30T00:00:00.000Z",
};

/** What next-auth's server-side auth() does with our session callback's result. */
function asAuthSees(token: Record<string, unknown>) {
  const session: Record<string, unknown> = sessionForToken({ ...baseSession }, token, NOW);
  return { user: token, ...session } as { user?: { id?: string } | null; twoFactorPending?: unknown };
}

describe("resolveAuthState", () => {
  it("a normal token is a signed-in user", () => {
    expect(resolveAuthState({ id: "u1" }, NOW)).toEqual({ kind: "user", userId: "u1" });
  });

  it("a Google sign-in waiting for its code is pending, not a user", () => {
    const token = { email: "k@example.com", pending2fa: { userId: "u1", since: NOW - 60_000 } };
    expect(resolveAuthState(token, NOW)).toEqual({ kind: "pending", userId: "u1", email: "k@example.com" });
  });

  it("the pending marker wins even if an id is somehow present", () => {
    const token = { id: "u1", pending2fa: { userId: "u1", since: NOW } };
    expect(resolveAuthState(token, NOW).kind).toBe("pending");
  });

  it("a pending sign-in lapses after the window", () => {
    const token = { pending2fa: { userId: "u1", since: NOW - PENDING_2FA_MAX_AGE_MS - 1 } };
    expect(resolveAuthState(token, NOW)).toEqual({ kind: "none" });
  });

  it("a malformed pending marker or a token without id is nobody", () => {
    expect(resolveAuthState({ pending2fa: { userId: 5 } }, NOW)).toEqual({ kind: "none" });
    expect(resolveAuthState({ pending2fa: "yes", id: "u1" }, NOW)).toEqual({ kind: "none" });
    expect(resolveAuthState({ email: "k@example.com" }, NOW)).toEqual({ kind: "none" });
    expect(resolveAuthState(null, NOW)).toEqual({ kind: "none" });
  });
});

describe("sessionForToken — what auth() returns", () => {
  it("a normal user keeps the user with its id", () => {
    const s = asAuthSees({ id: "u1" });
    expect(s.user?.id).toBe("u1");
    expect(s.twoFactorPending).toBeUndefined();
  });

  it("a pending session has NO user — every session?.user?.id guard refuses it", () => {
    const s = asAuthSees({ email: "k@example.com", pending2fa: { userId: "u1", since: NOW } });
    expect(s.user).toBeNull();
    expect(s.user?.id).toBeUndefined();
    expect(s.twoFactorPending).toEqual({ userId: "u1", email: "k@example.com" });
  });

  it("an id-less token is not signed in (next-auth's raw-token fallback is overridden)", () => {
    const s = asAuthSees({ name: "x", email: "x@example.com" });
    expect(s.user).toBeNull();
  });

  it("an expired pending session is neither a user nor pending", () => {
    const s = asAuthSees({ pending2fa: { userId: "u1", since: NOW - PENDING_2FA_MAX_AGE_MS - 1 } });
    expect(s.user).toBeNull();
    expect(s.twoFactorPending).toBeUndefined();
  });

  it("survives the JSON round-trip auth() does", () => {
    const s = JSON.parse(JSON.stringify(asAuthSees({ pending2fa: { userId: "u1", since: NOW } })));
    expect(s.user).toBeNull();
    expect(s.twoFactorPending.userId).toBe("u1");
  });
});

describe("gateRequest — the middleware", () => {
  const user = { user: { id: "u1" } };
  const pending = { user: null, twoFactorPending: { userId: "u1", email: null } };

  it("pending sessions reach only the code page", () => {
    expect(gateRequest(TWO_FACTOR_PATH, pending)).toEqual({ type: "allow" });
    for (const path of ["/dashboard", "/clients/abc", "/settings", "/sessions/new", "/", "/login", "/register"]) {
      expect(gateRequest(path, pending)).toEqual({ type: "redirect", to: TWO_FACTOR_PATH });
    }
  });

  it("the agreement text stays readable for everyone", () => {
    expect(gateRequest("/agreement", pending)).toEqual({ type: "allow" });
    expect(gateRequest("/agreement", null)).toEqual({ type: "allow" });
    expect(gateRequest("/terms", null)).toEqual({ type: "allow" });
    expect(gateRequest("/terms", pending)).toEqual({ type: "allow" });
    expect(gateRequest("/privacy", null)).toEqual({ type: "allow" });
  });

  it("guests see public pages and are refused app pages", () => {
    expect(gateRequest("/login", null)).toEqual({ type: "allow" });
    expect(gateRequest(TWO_FACTOR_PATH, null)).toEqual({ type: "allow" }); // the page itself sends them to /login
    expect(gateRequest("/dashboard", null)).toEqual({ type: "deny" });
    expect(gateRequest("/dashboard", { user: null })).toEqual({ type: "deny" });
  });

  it("signed-in users get the app and are bounced off the public pages", () => {
    expect(gateRequest("/dashboard", user)).toEqual({ type: "allow" });
    expect(gateRequest("/login", user)).toEqual({ type: "redirect", to: "/dashboard" });
    expect(gateRequest(TWO_FACTOR_PATH, user)).toEqual({ type: "redirect", to: "/dashboard" });
  });

  it("a user object without an id is not signed in", () => {
    expect(gateRequest("/dashboard", { user: {} })).toEqual({ type: "deny" });
  });
});
