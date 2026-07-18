import { beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";

beforeAll(() => {
  process.env.NOTES_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

describe("note encryption", () => {
  it("round-trips Hebrew plaintext", async () => {
    const { encryptNote, decryptNote } = await import("@/lib/crypto");
    const plaintext = "סיכום פגישה: המטופל דיווח על שיפור. 🙂";
    const payload = encryptNote(plaintext);
    expect(payload.contentCiphertext).not.toContain(plaintext);
    expect(decryptNote(payload)).toBe(plaintext);
  });

  it("produces a unique IV per encryption", async () => {
    const { encryptNote } = await import("@/lib/crypto");
    const a = encryptNote("same text");
    const b = encryptNote("same text");
    expect(a.contentIv).not.toBe(b.contentIv);
    expect(a.contentCiphertext).not.toBe(b.contentCiphertext);
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptNote, decryptNote } = await import("@/lib/crypto");
    const payload = encryptNote("original");
    const corrupted = Buffer.from(payload.contentCiphertext, "base64");
    corrupted[0] ^= 0xff;
    expect(() =>
      decryptNote({ ...payload, contentCiphertext: corrupted.toString("base64") }),
    ).toThrow();
  });

  it("round-trips packed secrets", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const secret = "morning-api-secret-אבג";
    const packed = encryptSecret(secret);
    expect(packed.split(":")).toHaveLength(3);
    expect(decryptSecret(packed)).toBe(secret);
    expect(() => decryptSecret("not-a-packed-secret")).toThrow();
  });

  it("rejects a wrong-length key", async () => {
    const { encryptNote } = await import("@/lib/crypto");
    const prev = process.env.NOTES_ENCRYPTION_KEY;
    process.env.NOTES_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    expect(() => encryptNote("x")).toThrow(/32 bytes/);
    process.env.NOTES_ENCRYPTION_KEY = prev;
  });
});
