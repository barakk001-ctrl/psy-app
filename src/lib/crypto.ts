import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

// ── Key versions ────────────────────────────────────────────────────────────
//
// Every encrypted value keeps its IV in a string, in all three formats (note
// columns, file columns, packed iv:tag:ciphertext). The key version travels at
// the front of that string: "k2.<iv>" was encrypted with key 2. Base64 has no
// ".", so the old values read as they always did: no prefix = key 1.
//
// Keys come from the environment: NOTES_ENCRYPTION_KEY is key 1, and
// NOTES_ENCRYPTION_KEY_V2, _V3… are later ones. The highest version present
// encrypts; every version present decrypts. With only NOTES_ENCRYPTION_KEY set
// (production today) new values are written exactly as before, with no prefix.
//
// Rotating, from a fresh key: set NOTES_ENCRYPTION_KEY_V2 (new writes use it at
// once, old values still read), run the re-encryption job (reencrypt.ts) until
// it reports nothing left, and only then remove the old key.

function decodeKey(name: string, value: string): Buffer {
  const buf = Buffer.from(value, "base64");
  if (buf.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes (base64-encoded).`);
  }
  return buf;
}

function keyEnv(version: number): string {
  return version === 1 ? "NOTES_ENCRYPTION_KEY" : `NOTES_ENCRYPTION_KEY_V${version}`;
}

function keyFor(version: number): Buffer {
  const name = keyEnv(version);
  const value = process.env[name];
  if (!value) {
    throw new Error(
      version === 1
        ? "NOTES_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
        : `${name} is not set, and a stored value needs it.`,
    );
  }
  return decodeKey(name, value);
}

/** The version new values are encrypted with: the highest key present. */
export function activeKeyVersion(): number {
  let active = 1;
  for (const name of Object.keys(process.env)) {
    const m = /^NOTES_ENCRYPTION_KEY_V([1-9]\d*)$/.exec(name);
    if (m && process.env[name] && Number(m[1]) > active) active = Number(m[1]);
  }
  return active;
}

/** Which key a stored IV (or a packed value) belongs to. */
export function keyVersionOf(ivOrPacked: string): number {
  const m = /^k([1-9]\d*)\./.exec(ivOrPacked);
  return m ? Number(m[1]) : 1;
}

function withVersion(version: number, iv: string): string {
  return version === 1 ? iv : `k${version}.${iv}`;
}

function bareIv(iv: string): Buffer {
  return Buffer.from(iv.replace(/^k[1-9]\d*\./, ""), "base64");
}

export type EncryptedPayload = {
  contentCiphertext: string;
  contentIv: string;
  contentTag: string;
};

function encryptBytes(data: Buffer): { ciphertext: Buffer; iv: string; tag: string } {
  const version = activeKeyVersion();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, keyFor(version), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return {
    ciphertext,
    iv: withVersion(version, iv.toString("base64")),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptBytes(parts: { ciphertext: Buffer; iv: string; tag: string }): Buffer {
  const decipher = crypto.createDecipheriv(ALGO, keyFor(keyVersionOf(parts.iv)), bareIv(parts.iv));
  decipher.setAuthTag(Buffer.from(parts.tag, "base64"));
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
}

export function encryptNote(plaintext: string): EncryptedPayload {
  const p = encryptBytes(Buffer.from(plaintext, "utf8"));
  return {
    contentCiphertext: p.ciphertext.toString("base64"),
    contentIv: p.iv,
    contentTag: p.tag,
  };
}

export function decryptNote(parts: EncryptedPayload): string {
  return decryptBytes({
    ciphertext: Buffer.from(parts.contentCiphertext, "base64"),
    iv: parts.contentIv,
    tag: parts.contentTag,
  }).toString("utf8");
}

// Binary variant for file attachments — same keys and algorithm.
export function encryptBuffer(data: Buffer): {
  ciphertext: Buffer;
  iv: string;
  tag: string;
} {
  return encryptBytes(data);
}

export function decryptBuffer(parts: {
  ciphertext: Buffer;
  iv: string;
  tag: string;
}): Buffer {
  return decryptBytes(parts);
}

// Single-column variant for short secrets (e.g. API credentials): packs
// iv:tag:ciphertext into one string using the same keys.
export function encryptSecret(plaintext: string): string {
  const p = encryptNote(plaintext);
  return `${p.contentIv}:${p.contentTag}:${p.contentCiphertext}`;
}

export function decryptSecret(packed: string): string {
  const [contentIv, contentTag, contentCiphertext] = packed.split(":");
  if (!contentIv || !contentTag || !contentCiphertext) {
    throw new Error("Malformed packed secret");
  }
  return decryptNote({ contentIv, contentTag, contentCiphertext });
}
