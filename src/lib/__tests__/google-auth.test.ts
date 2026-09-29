import { describe, expect, it } from "vitest";
import {
  decideGoogleSignIn,
  displayNameFor,
  isGoogleConfigured,
  tokenForGoogleUser,
} from "@/lib/google-auth";
import { resolveAuthState } from "@/lib/auth-gate";

const base = {
  email: "Keren@Example.com",
  emailVerified: true,
  googleName: "קרן כהן",
  existingUserId: null,
  agreementAccepted: false,
};

describe("isGoogleConfigured", () => {
  it("needs both keys", () => {
    expect(isGoogleConfigured({})).toBe(false);
    expect(isGoogleConfigured({ AUTH_GOOGLE_ID: "id" })).toBe(false);
    expect(isGoogleConfigured({ AUTH_GOOGLE_SECRET: "s" })).toBe(false);
    expect(isGoogleConfigured({ AUTH_GOOGLE_ID: " ", AUTH_GOOGLE_SECRET: "s" })).toBe(false);
    expect(isGoogleConfigured({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).toBe(true);
  });
});

describe("decideGoogleSignIn", () => {
  it("an existing email signs in to that account (linking)", () => {
    expect(decideGoogleSignIn({ ...base, existingUserId: "u1" })).toEqual({ type: "link", userId: "u1" });
  });

  it("an existing account is linked even without the agreement cookie", () => {
    expect(decideGoogleSignIn({ ...base, existingUserId: "u1", agreementAccepted: false }).type).toBe("link");
  });

  it("a new email with the agreement accepted creates a practice, email lower-cased", () => {
    expect(decideGoogleSignIn({ ...base, agreementAccepted: true })).toEqual({
      type: "create",
      email: "keren@example.com",
      name: "קרן כהן",
    });
  });

  it("a new email without the agreement is sent to accept it first", () => {
    expect(decideGoogleSignIn(base)).toEqual({ type: "need-agreement" });
  });

  it("an unverified Google email is refused — even for an existing account", () => {
    expect(decideGoogleSignIn({ ...base, emailVerified: false, existingUserId: "u1" })).toEqual({
      type: "reject",
      reason: "unverified",
    });
    expect(decideGoogleSignIn({ ...base, emailVerified: undefined }).type).toBe("reject");
    expect(decideGoogleSignIn({ ...base, emailVerified: "true" }).type).toBe("reject");
  });

  it("no email is refused", () => {
    expect(decideGoogleSignIn({ ...base, email: null }).type).toBe("reject");
    expect(decideGoogleSignIn({ ...base, email: "  " }).type).toBe("reject");
  });
});

describe("displayNameFor", () => {
  it("prefers Google's name, else the email's local part", () => {
    expect(displayNameFor("  קרן  ", "k@example.com")).toBe("קרן");
    expect(displayNameFor(null, "keren.cohen@example.com")).toBe("keren.cohen");
    expect(displayNameFor("", "k@example.com")).toBe("k@example.com");
  });
});

describe("tokenForGoogleUser", () => {
  const user = { id: "u1", name: "קרן", email: "k@example.com", totpEnabled: false, totpSecret: null };

  it("without 2FA the Google sign-in is a normal session", () => {
    const token = tokenForGoogleUser(user, 1000);
    expect(token).toEqual({ sub: "u1", name: "קרן", email: "k@example.com", id: "u1" });
    expect(resolveAuthState(token, 1000)).toEqual({ kind: "user", userId: "u1" });
  });

  it("with 2FA on it is pending and carries no id", () => {
    const token = tokenForGoogleUser({ ...user, totpEnabled: true, totpSecret: "enc" }, 1000);
    expect(token.id).toBeUndefined();
    expect(token.pending2fa).toEqual({ userId: "u1", since: 1000 });
    expect(resolveAuthState(token, 2000).kind).toBe("pending");
  });

  it("2FA flagged on without a secret behaves like the password login (no code asked)", () => {
    const token = tokenForGoogleUser({ ...user, totpEnabled: true, totpSecret: null }, 1000);
    expect(token.id).toBe("u1");
  });
});
