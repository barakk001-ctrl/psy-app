// TOTP two-factor auth (RFC 6238) — compatible with Google Authenticator,
// Apple Passwords, Authy, etc.

import * as OTPAuth from "otpauth";

const ISSUER = "מרפאה";

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildOtpAuthUri(email: string, secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

/** Validates a 6-digit code with ±1 time-step tolerance for clock drift. */
export function verifyTotp(
  secretBase32: string,
  token: string,
  timestamp?: number,
): boolean {
  const cleaned = token.replace(/\D/g, "");
  if (cleaned.length !== 6) return false;
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: cleaned, window: 1, timestamp });
  return delta !== null;
}

/** Generates the current code — used only in tests. */
export function generateTotpCode(secretBase32: string, timestamp?: number): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate({ timestamp });
}
