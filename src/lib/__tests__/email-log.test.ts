import { describe, expect, it } from "vitest";
import { emailDomain, emailFailureLog } from "../email-log";

describe("emailDomain", () => {
  it("takes the domain from a display-name address", () => {
    expect(emailDomain("מרפאה <onboarding@Resend.dev>")).toBe("resend.dev");
  });
  it("takes the domain from a bare address", () => {
    expect(emailDomain("someone@gmail.com")).toBe("gmail.com");
  });
  it("is '-' when missing or malformed", () => {
    expect(emailDomain(undefined)).toBe("-");
    expect(emailDomain("")).toBe("-");
    expect(emailDomain("not-an-address")).toBe("-");
  });
});

describe("emailFailureLog", () => {
  it("includes reason, code, status and domains but never the full recipient", () => {
    const line = emailFailureLog({
      reason: "You can only send testing emails to your own email address",
      code: "validation_error",
      status: 403,
      from: "Clinic <onboarding@resend.dev>",
      to: "patient.name@gmail.com",
    });
    expect(line).toContain("You can only send testing emails");
    expect(line).toContain("code=validation_error");
    expect(line).toContain("status=403");
    expect(line).toContain("from-domain=resend.dev");
    expect(line).toContain("to-domain=gmail.com");
    expect(line).not.toContain("patient.name");
  });
  it("omits code and status when the provider gives none", () => {
    const line = emailFailureLog({ reason: "RESEND_API_KEY is not configured" });
    expect(line).toBe(
      "[email] send failed: RESEND_API_KEY is not configured | from-domain=- | to-domain=-",
    );
  });
});
