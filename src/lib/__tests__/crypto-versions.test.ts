import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activeKeyVersion,
  decryptBuffer,
  decryptNote,
  decryptSecret,
  encryptBuffer,
  encryptNote,
  encryptSecret,
  keyVersionOf,
} from "@/lib/crypto";
import { clientIdNumber, inboxText, openText, sealClientFields, sealFileName, sealInboxText, sessionFileName } from "@/lib/sensitive-fields";

const KEY1 = Buffer.alloc(32, 1).toString("base64");
const KEY2 = Buffer.alloc(32, 2).toString("base64");

/** The exact format production wrote before key versions: no prefix on the IV. */
function legacyEncrypt(text: string, keyB64: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return {
    contentCiphertext: ct.toString("base64"),
    contentIv: iv.toString("base64"),
    contentTag: c.getAuthTag().toString("base64"),
  };
}

describe("key versions", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.NOTES_ENCRYPTION_KEY = KEY1;
    delete process.env.NOTES_ENCRYPTION_KEY_V2;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("with one key, new values are written exactly as before: no prefix", () => {
    expect(activeKeyVersion()).toBe(1);
    const n = encryptNote("טקסט");
    expect(n.contentIv).not.toContain(".");
    expect(Buffer.from(n.contentIv, "base64")).toHaveLength(12);
    expect(encryptSecret("x").split(":")).toHaveLength(3);
    expect(encryptBuffer(Buffer.from("x")).iv).not.toContain(".");
  });

  it("reads every value written before versions existed", () => {
    const old = legacyEncrypt("סיכום ישן", KEY1);
    expect(decryptNote(old)).toBe("סיכום ישן");
    expect(decryptSecret(`${old.contentIv}:${old.contentTag}:${old.contentCiphertext}`)).toBe("סיכום ישן");
    expect(keyVersionOf(old.contentIv)).toBe(1);
  });

  it("with a second key, new values use it and old values still read", () => {
    const before = encryptNote("לפני");
    const secretBefore = encryptSecret("סוד");
    const fileBefore = encryptBuffer(Buffer.from("קובץ"));

    process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
    expect(activeKeyVersion()).toBe(2);
    const after = encryptNote("אחרי");
    expect(keyVersionOf(after.contentIv)).toBe(2);
    expect(after.contentIv.startsWith("k2.")).toBe(true);
    expect(keyVersionOf(encryptSecret("x"))).toBe(2);

    expect(decryptNote(before)).toBe("לפני");
    expect(decryptNote(after)).toBe("אחרי");
    expect(decryptSecret(secretBefore)).toBe("סוד");
    expect(decryptBuffer(fileBefore).toString()).toBe("קובץ");
    expect(decryptBuffer(encryptBuffer(Buffer.from("חדש"))).toString()).toBe("חדש");
  });

  it("a new-key value doesn't open with the old key alone, and says why", () => {
    process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
    const v2 = encryptNote("טקסט");
    delete process.env.NOTES_ENCRYPTION_KEY_V2;
    expect(() => decryptNote(v2)).toThrow(/NOTES_ENCRYPTION_KEY_V2 is not set/);
  });

  it("once rotated, the old key can go: new-key values don't need it", () => {
    process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
    const v2 = encryptNote("טקסט");
    delete process.env.NOTES_ENCRYPTION_KEY;
    expect(decryptNote(v2)).toBe("טקסט");
    expect(() => decryptNote(legacyEncrypt("ישן", KEY1))).toThrow(/NOTES_ENCRYPTION_KEY is not set/);
  });

  it("the error names the variable, never a value", () => {
    process.env.NOTES_ENCRYPTION_KEY = "too-short";
    expect(() => encryptNote("x")).toThrow("NOTES_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded).");
  });
});

describe("fields moving to encrypted columns", () => {
  beforeEach(() => {
    process.env.NOTES_ENCRYPTION_KEY = KEY1;
  });

  it("reads both forms, and prefers the encrypted one", () => {
    expect(openText(null, "גלוי")).toBe("גלוי");
    expect(openText(encryptSecret("מוצפן"), "גלוי")).toBe("מוצפן");
    expect(openText(null, null)).toBeNull();
    expect(openText(null, "")).toBeNull();
  });

  it("a damaged value falls back instead of breaking the page", () => {
    expect(openText("not:a:cipher", "גלוי")).toBe("גלוי");
    expect(openText("not:a:cipher", null)).toBeNull();
  });

  it("a new write leaves no plain text behind", () => {
    const row = sealClientFields({ idNumber: "000000018", generalNotes: "הערה" });
    expect(row.idNumber).toBeNull();
    expect(row.generalNotes).toBeNull();
    expect(row.idNumberCiphertext).not.toContain("000000018");
    expect(clientIdNumber(row)).toBe("000000018");
    expect(sealFileName("מכתב.pdf").fileName).toBe("");
    expect(sessionFileName(sealFileName("מכתב.pdf"))).toBe("מכתב.pdf");
    expect(inboxText(sealInboxText("הודעה"))).toBe("הודעה");
  });

  it("an empty field stays empty, and clearing one clears it", () => {
    expect(sealClientFields({ idNumber: "", generalNotes: null })).toEqual({
      idNumber: null,
      idNumberCiphertext: null,
      generalNotes: null,
      generalNotesCiphertext: null,
    });
  });
});

describe("nothing reads these columns directly", () => {
  // A page reading a plain column still compiles, and would silently show a
  // blank for every row saved since the move. Only these may touch them.
  const ALLOWED = new Set([
    "lib/sensitive-fields.ts",
    "lib/encrypted-fields-backfill.ts",
    // plain values handed down as props, after the helpers
    "components/clients/client-form.tsx",
    "components/invoices/document-form.tsx",
    "components/invoices/invoice-pdf.tsx",
    "components/sessions/session-files-card.tsx",
    // a client document's own name, a different field (encrypted already)
    "components/clients/client-documents-card.tsx",
    "lib/client-documents.ts",
  ]);
  const READ = /\b(?:\w+\.)+(idNumber|generalNotes|fileName)\b/;

  function sources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it("every read goes through sensitive-fields.ts", () => {
    const root = path.join(process.cwd(), "src");
    const offenders = sources(root).flatMap((file) => {
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (ALLOWED.has(rel)) return [];
      return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => READ.test(line))
        .map((line) => `${rel}: ${line.trim()}`);
    });
    expect(offenders).toEqual([]);
  });
});
