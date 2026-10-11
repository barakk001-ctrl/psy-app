import { describe, expect, it } from "vitest";
import {
  chooseLoginCodeChannel,
  isSmsConfigured,
  normalizeIsraeliMobile,
} from "../login-code-channel";
import { buildLoginCodeEmail, loginCodeSmsText } from "../login-code-email";

describe("chooseLoginCodeChannel", () => {
  it("uses email unless SMS is asked for, set up and the account has a mobile", () => {
    expect(chooseLoginCodeChannel(undefined, { loginPhone: "0501234567" }, true)).toBe("email");
    expect(chooseLoginCodeChannel("sms", { loginPhone: "0501234567" }, false)).toBe("email");
    expect(chooseLoginCodeChannel("sms", { loginPhone: null }, true)).toBe("email");
    expect(chooseLoginCodeChannel("sms", { loginPhone: "03-1234567" }, true)).toBe("email");
    expect(chooseLoginCodeChannel("sms", { loginPhone: "050-123-4567" }, true)).toBe("sms");
  });
});

describe("isSmsConfigured", () => {
  it("is off with no provider, and with a provider nobody implemented", () => {
    expect(isSmsConfigured({})).toBe(false);
    expect(isSmsConfigured({ SMS_PROVIDER: "nope", SMS_API_KEY: "x" })).toBe(false);
  });
});

describe("normalizeIsraeliMobile", () => {
  it("normalises Israeli mobiles to E.164", () => {
    expect(normalizeIsraeliMobile("050-123 4567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("+972 50 1234567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("972541234567")).toBe("+972541234567");
  });
  it("rejects landlines and junk", () => {
    expect(normalizeIsraeliMobile("03-1234567")).toBeNull();
    expect(normalizeIsraeliMobile("")).toBeNull();
    expect(normalizeIsraeliMobile("05012")).toBeNull();
  });
});

describe("login code messages", () => {
  it("puts the code in the email subject and body, in Hebrew", () => {
    const m = buildLoginCodeEmail({ name: "קרן", code: "042917" });
    expect(m.subject).toBe("קוד הכניסה שלך למרפאה אישית: 042917");
    expect(m.text).toContain("042917");
    expect(m.html).toContain('dir="rtl"');
    expect(m.html).toContain("042917");
  });
  it("escapes the name in the HTML", () => {
    expect(buildLoginCodeEmail({ name: "<b>x</b>", code: "1" }).html).not.toContain("<b>x</b>");
  });
  it("has an SMS text ready", () => {
    expect(loginCodeSmsText("123456")).toContain("קוד הכניסה שלך למרפאה אישית: 123456");
  });
});
