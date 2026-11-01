import { describe, expect, it } from "vitest";
import {
  EMAIL_VERIFY_TTL_MS,
  googleVerifiedUpdate,
  hashVerifyToken,
  issueVerifyToken,
  registrationStep,
} from "@/lib/email-verification";
import { buildExistingAccountEmail, buildVerifyEmail } from "@/lib/verify-email-mail";
import { buildResetEmail } from "@/lib/reset-email";
import { gateRequest } from "@/lib/auth-gate";

const NOW = 1_800_000_000_000;

describe("verification tokens", () => {
  it("stores only a hash, and each token is different", () => {
    const a = issueVerifyToken(NOW);
    const b = issueVerifyToken(NOW);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toContain(a.token);
    expect(a.hash).toBe(hashVerifyToken(a.token));
  });

  it("expires after 24 hours", () => {
    expect(issueVerifyToken(NOW).expiresAt.getTime()).toBe(NOW + EMAIL_VERIFY_TTL_MS);
    expect(EMAIL_VERIFY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("registrationStep", () => {
  it("a closed sign-up refuses without looking at whether the address has an account", () => {
    expect(registrationStep({ allowed: false, existing: null })).toBe("refuse");
    expect(registrationStep({ allowed: false, existing: { emailVerifiedAt: new Date() } })).toBe("refuse");
    expect(registrationStep({ allowed: false, existing: { emailVerifiedAt: null } })).toBe("refuse");
  });

  it("creates only a new address", () => {
    expect(registrationStep({ allowed: true, existing: null })).toBe("create");
  });

  it("never touches an existing account: a new link or a notice to its owner", () => {
    expect(registrationStep({ allowed: true, existing: { emailVerifiedAt: null } })).toBe("resend-link");
    expect(registrationStep({ allowed: true, existing: { emailVerifiedAt: new Date() } })).toBe("notify-owner");
  });
});

describe("googleVerifiedUpdate", () => {
  it("drops the unproven password and the pending link", () => {
    const now = new Date(NOW);
    expect(googleVerifiedUpdate(now, "שם")).toEqual({
      name: "שם",
      emailVerifiedAt: now,
      hashedPassword: null,
      emailVerifyTokenHash: null,
      emailVerifyExpiresAt: null,
    });
  });
});

describe("sign-up emails", () => {
  it("the verification email is Hebrew and holds the link in both parts", () => {
    const url = "https://mirpaa.app/verify-email/abc";
    const mail = buildVerifyEmail({ verifyUrl: url });
    expect(mail.subject).toContain("אישור");
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain('dir="rtl"');
  });

  it("the notice to an existing owner holds no link that changes anything", () => {
    const mail = buildExistingAccountEmail({
      loginUrl: "https://mirpaa.app/login",
      resetUrl: "https://mirpaa.app/forgot-password",
    });
    expect(mail.text).toContain("https://mirpaa.app/login");
    expect(mail.text).toContain("https://mirpaa.app/forgot-password");
  });

  it("the reset email escapes the name typed at sign-up", () => {
    const mail = buildResetEmail({ name: '<a href="https://evil.test">x</a>', resetUrl: "https://mirpaa.app/r" });
    expect(mail.html).not.toContain("<a href=\"https://evil.test\"");
  });
});

describe("the verification page is public", () => {
  it("guests reach it; a signed-in user goes to the dashboard", () => {
    expect(gateRequest("/verify-email/abc", null)).toEqual({ type: "allow" });
    expect(gateRequest("/verify-email/abc", { user: { id: "u1" } })).toEqual({ type: "redirect", to: "/dashboard" });
  });
});
