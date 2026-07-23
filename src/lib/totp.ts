// TOTP two-factor auth (RFC 6238) — compatible with Google Authenticator,
// Apple Passwords, Authy, etc. Plus one-time backup codes.

import crypto from "node:crypto";
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

// ── One-time backup codes ──────────────────────────────────────────
// Format XXXX-XXXX from an alphabet without ambiguous characters. Stored as
// sha256 hashes (the codes have enough entropy that bcrypt is unnecessary);
// a hash is removed the moment its code is used.

const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeBackupCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

export function generateBackupCodes(count = 5): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      raw += BACKUP_ALPHABET[bytes[j] % BACKUP_ALPHABET.length];
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return { codes, hashes: codes.map(hashBackupCode) };
}

/** True when the input looks like a backup code rather than a 6-digit TOTP. */
export function looksLikeBackupCode(input: string): boolean {
  return normalizeBackupCode(input).length === 8;
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
