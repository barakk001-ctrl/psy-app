import { describe, expect, it } from "vitest";
import {
  INVITE_ONLY_MESSAGE,
  canCreateAccount,
  inviteOnly,
  parseAllowlist,
  signupOpen,
} from "@/lib/signup-policy";
import { decideGoogleSignIn } from "@/lib/google-auth";

const prod = { NODE_ENV: "production", ALLOWED_EMAILS: "invited@example.com, Other@Example.com " };

describe("email sign-up", () => {
  it("an allowlisted email can create an account (any case, spaces ignored)", () => {
    expect(canCreateAccount("invited@example.com", prod)).toBe(true);
    expect(canCreateAccount("other@example.com", prod)).toBe(true);
  });

  it("an unknown email is blocked while sign-up is by invitation", () => {
    expect(canCreateAccount("stranger@example.com", prod)).toBe(false);
  });

  it("production without an allowlist is closed; development without one is open", () => {
    expect(canCreateAccount("anyone@example.com", { NODE_ENV: "production" })).toBe(false);
    expect(canCreateAccount("anyone@example.com", { NODE_ENV: "development" })).toBe(true);
  });

  it("SIGNUP_OPEN=true opens it to everyone — one variable", () => {
    expect(canCreateAccount("stranger@example.com", { ...prod, SIGNUP_OPEN: "true" })).toBe(true);
    expect(signupOpen({ SIGNUP_OPEN: "1" })).toBe(true);
    expect(signupOpen({ SIGNUP_OPEN: "false" })).toBe(false);
    expect(signupOpen({})).toBe(false);
  });
});

describe("Google sign-in / sign-up", () => {
  const google = { email: "Stranger@Example.com", emailVerified: true, googleName: "מישהי", agreementAccepted: true };

  it("an existing Google user signs in, invited or not", () => {
    expect(
      decideGoogleSignIn({ ...google, existingUserId: "u1", creationAllowed: false }),
    ).toEqual({ type: "link", userId: "u1" });
  });

  it("an unknown Google email is blocked from creating an account", () => {
    expect(
      decideGoogleSignIn({
        ...google,
        existingUserId: null,
        creationAllowed: canCreateAccount("stranger@example.com", prod),
      }),
    ).toEqual({ type: "not-invited" });
  });

  it("an allowlisted Google email can create one", () => {
    expect(
      decideGoogleSignIn({
        ...google,
        email: "Invited@Example.com",
        existingUserId: null,
        creationAllowed: canCreateAccount("invited@example.com", prod),
      }),
    ).toEqual({ type: "create", email: "invited@example.com", name: "מישהי" });
  });

  it("a blocked email is told it's invitation-only before being asked for the agreement", () => {
    expect(
      decideGoogleSignIn({ ...google, existingUserId: null, agreementAccepted: false, creationAllowed: false }).type,
    ).toBe("not-invited");
  });
});

describe("invite-only pages", () => {
  it("show while sign-up is closed, not once it is open", () => {
    expect(inviteOnly(prod)).toBe(true);
    expect(inviteOnly({ NODE_ENV: "production" })).toBe(true);
    expect(inviteOnly({ ...prod, SIGNUP_OPEN: "true" })).toBe(false);
    expect(inviteOnly({ NODE_ENV: "development" })).toBe(false);
  });

  it("name the address to ask, as text", () => {
    expect(INVITE_ONLY_MESSAGE).toBe("ההרשמה כרגע בהזמנה בלבד. לבקשת הצטרפות: barak@mirpaa.app");
    expect(parseAllowlist(" a@x.com ,,B@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });
});
