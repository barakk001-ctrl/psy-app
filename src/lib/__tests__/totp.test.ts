import { describe, expect, it } from "vitest";
import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateTotpCode,
  generateTotpSecret,
  hashBackupCode,
  looksLikeBackupCode,
  verifyTotp,
} from "@/lib/totp";

const T = 1_800_000_000_000; // fixed timestamp

describe("totp", () => {
  it("verifies a freshly generated code", () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret, T);
    expect(verifyTotp(secret, code, T)).toBe(true);
  });

  it("accepts a code from the previous 30s window (clock drift)", () => {
    const secret = generateTotpSecret();
    const prev = generateTotpCode(secret, T - 30_000);
    expect(verifyTotp(secret, prev, T)).toBe(true);
  });

  it("rejects wrong or stale codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "000000", T)).toBe(false);
    const stale = generateTotpCode(secret, T - 5 * 60_000);
    expect(verifyTotp(secret, stale, T)).toBe(false);
  });

  it("rejects malformed input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "", T)).toBe(false);
    expect(verifyTotp(secret, "12345", T)).toBe(false);
    expect(verifyTotp(secret, "abcdef", T)).toBe(false);
  });

  it("generates one-time backup codes with matching hashes", () => {
    const { codes, hashes } = generateBackupCodes(5);
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
    for (const [i, code] of codes.entries()) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(hashBackupCode(code)).toBe(hashes[i]);
      // Case/format-insensitive: lowercase without the dash still hashes equal
      expect(hashBackupCode(code.toLowerCase().replace("-", ""))).toBe(hashes[i]);
    }
  });

  it("distinguishes backup codes from TOTP codes", () => {
    expect(looksLikeBackupCode("ABCD-EFGH")).toBe(true);
    expect(looksLikeBackupCode("abcdefgh")).toBe(true);
    expect(looksLikeBackupCode("123456")).toBe(false);
    expect(looksLikeBackupCode("")).toBe(false);
  });

  it("builds a scannable otpauth URI", () => {
    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri("barak@example.com", secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("barak%40example.com");
  });
});
