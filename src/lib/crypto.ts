import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.NOTES_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "NOTES_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("NOTES_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded).");
  }
  return buf;
}

export type EncryptedPayload = {
  contentCiphertext: string;
  contentIv: string;
  contentTag: string;
};

export function encryptNote(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    contentCiphertext: ciphertext.toString("base64"),
    contentIv: iv.toString("base64"),
    contentTag: tag.toString("base64"),
  };
}

export function decryptNote(parts: EncryptedPayload): string {
  const iv = Buffer.from(parts.contentIv, "base64");
  const tag = Buffer.from(parts.contentTag, "base64");
  const ciphertext = Buffer.from(parts.contentCiphertext, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
