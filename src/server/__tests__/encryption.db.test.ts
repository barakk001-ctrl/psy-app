import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_BYTES, seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "encryption");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null } };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const KEY2 = Buffer.alloc(32, 9).toString("base64");

describe.skipIf(!TEST_DATABASE_URL)("encrypted fields and key rotation (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("encryption");
    db = (await import("@/lib/db")).dbAll;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
    delete process.env.NOTES_ENCRYPTION_KEY_V2;
  });

  /** Runs a client save from the form; it ends in a redirect. */
  async function saveClient(id?: string) {
    const { createClientAction, updateClientAction } = await import("@/server/actions/clients");
    const fd = form({
      ...(id ? { id } : {}),
      firstName: "חדשה",
      lastName: "לקוחה",
      idNumber: "000000018",
      generalNotes: "הערה חדשה",
    });
    await (id ? updateClientAction : createClientAction)(null, fd).catch(() => undefined);
  }

  describe("new writes", () => {
    it("a client's id number and notes are stored encrypted, and read back", async () => {
      await saveClient();
      const row = await db.client.findFirstOrThrow({ where: { userId: a.userId, firstName: "חדשה" } });
      expect(row.idNumber).toBeNull();
      expect(row.generalNotes).toBeNull();
      expect(row.idNumberCiphertext).toBeTruthy();
      expect(row.idNumberCiphertext).not.toContain("000000018");
      const { clientGeneralNotes, clientIdNumber } = await import("@/lib/sensitive-fields");
      expect(clientIdNumber(row)).toBe("000000018");
      expect(clientGeneralNotes(row)).toBe("הערה חדשה");
    });

    it("editing a client who had plain values moves them, and clearing clears both", async () => {
      await saveClient(a.clientId);
      let row = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
      expect(row.idNumber).toBeNull();
      expect(row.idNumberCiphertext).toBeTruthy();

      const { updateClientAction } = await import("@/server/actions/clients");
      await updateClientAction(null, form({ id: a.clientId, firstName: "חדשה", lastName: "לקוחה" })).catch(() => undefined);
      row = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
      expect([row.idNumber, row.idNumberCiphertext, row.generalNotes, row.generalNotesCiphertext]).toEqual([null, null, null, null]);
    });

    it("an uploaded file's name is stored encrypted and served back", async () => {
      const { uploadSessionFileAction } = await import("@/server/actions/files");
      await uploadSessionFileAction(
        null,
        form({ sessionId: a.sessionId, file: new File([PDF_BYTES], "מכתב-פרטי.pdf", { type: "application/pdf" }) }),
      );
      const row = await db.sessionFile.findFirstOrThrow({ where: { userId: a.userId, fileName: "" } });
      expect(row.fileNameCiphertext).toBeTruthy();
      const { GET } = await import("@/app/api/files/[id]/route");
      const res = await GET(new Request("http://t/x"), { params: Promise.resolve({ id: row.id }) });
      expect(res.status).toBe(200);
      expect(decodeURIComponent(res.headers.get("content-disposition") ?? "")).toContain("מכתב-פרטי.pdf");
    });

    it("a message from the API or the public form is stored encrypted and read back", async () => {
      const { POST } = await import("@/app/api/inbox/route");
      await POST(
        new Request("http://t/api/inbox", {
          method: "POST",
          body: "הודעה פרטית",
          headers: { authorization: `Bearer ${a.inboxApiToken}`, "content-type": "text/plain" },
        }),
      );
      const { submitAppointmentRequestAction, processInboxMessageAction } = await import("@/server/actions/inbox");
      await submitAppointmentRequestAction(null, form({ token: a.inboxToken, name: "פונה", phone: "0500000000" }));

      const rows = await db.inboxMessage.findMany({ where: { userId: a.userId, text: "" } });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.textCiphertext)).toBe(true);
      const texts = await Promise.all(rows.map((r) => processInboxMessageAction(r.id)));
      expect(texts.join("\n")).toContain("הודעה פרטית");
      expect(texts.join("\n")).toContain("פונה");
    });

    it("the invoice PDF and the summaries PDF data still get the id number", async () => {
      await saveClient(a.clientId);
      const { loadInvoicePdfData } = await import("@/lib/invoice-pdf-data");
      const loaded = await loadInvoicePdfData(a.oldInvoiceId, a.userId);
      expect(loaded?.data.client.idNumber).toBe("000000018");
    });
  });

  it("a row from before the change still reads, untouched", async () => {
    const { clientIdNumber, inboxText, sessionFileName } = await import("@/lib/sensitive-fields");
    const c = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
    expect(clientIdNumber(c)).toBe("000000026");
    const f = await db.sessionFile.findUniqueOrThrow({ where: { id: a.fileId } });
    expect(sessionFileName(f)).toContain(a.canary);
    const m = await db.inboxMessage.findUniqueOrThrow({ where: { id: a.inboxId } });
    expect(inboxText(m)).toContain(a.canary);
  });

  describe("the full export reads both forms", () => {
    it("old plain rows and new encrypted rows land in the same files", async () => {
      await saveClient();
      const { buildExportEntries } = await import("@/lib/account-export");
      const entries = await buildExportEntries(a.userId);
      const csv = entries.find((e) => e.path === "לקוחות.csv")!;
      const parts: Buffer[] = [];
      for await (const c of csv.body()) parts.push(c);
      const text = Buffer.concat(parts).toString("utf8");
      expect(text).toContain("000000026"); // plain
      expect(text).toContain("000000018"); // encrypted
      expect(text).toContain("הערה חדשה");
    });
  });

  describe("the backfill", () => {
    const backfill = async (o?: { copy?: boolean; clear?: boolean }) =>
      (await import("@/lib/encrypted-fields-backfill")).backfillEncryptedFields(o);

    it("is dry by default: counts and writes nothing", async () => {
      const before = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
      const report = await backfill();
      expect(report.toCopy["Client.idNumber"]).toBe(1);
      expect(report.copied).toBe(0);
      expect(report.cleared).toBe(0);
      expect(await db.client.findUniqueOrThrow({ where: { id: a.clientId } })).toEqual(before);
    });

    it("copy fills the encrypted columns and keeps the plain ones", async () => {
      const report = await backfill({ copy: true });
      expect(report.copied).toBeGreaterThanOrEqual(4);
      const c = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
      expect(c.idNumber).toBe("000000026");
      expect(c.idNumberCiphertext).toBeTruthy();
      const { decryptSecret } = await import("@/lib/crypto");
      expect(decryptSecret(c.idNumberCiphertext!)).toBe("000000026");
      // run again: nothing more to copy
      expect((await backfill({ copy: true })).copied).toBe(0);
    });

    it("clear empties the plain columns, and every value still reads", async () => {
      await backfill({ copy: true });
      const report = await backfill({ clear: true });
      expect(report.cleared).toBeGreaterThanOrEqual(4);
      expect(report.mismatched).toEqual([]);

      const c = await db.client.findUniqueOrThrow({ where: { id: a.clientId } });
      const f = await db.sessionFile.findUniqueOrThrow({ where: { id: a.fileId } });
      const m = await db.inboxMessage.findUniqueOrThrow({ where: { id: a.inboxId } });
      expect([c.idNumber, c.generalNotes, f.fileName, m.text]).toEqual([null, null, "", ""]);

      const { clientGeneralNotes, clientIdNumber, inboxText, sessionFileName } = await import("@/lib/sensitive-fields");
      expect(clientIdNumber(c)).toBe("000000026");
      expect(clientGeneralNotes(c)).toContain(a.canary);
      expect(sessionFileName(f)).toContain(a.canary);
      expect(inboxText(m)).toContain(a.canary);
    });

    it("never clears a value whose encrypted copy doesn't match", async () => {
      await backfill({ copy: true });
      const { encryptSecret } = await import("@/lib/crypto");
      await db.client.update({ where: { id: a.clientId }, data: { idNumberCiphertext: encryptSecret("000000000") } });
      const report = await backfill({ clear: true });
      expect(report.mismatched).toEqual([`Client.idNumber ${a.clientId}`]);
      expect((await db.client.findUniqueOrThrow({ where: { id: a.clientId } })).idNumber).toBe("000000026");
    });

    it("no app path runs it", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const walk = (d: string): string[] =>
        fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(d, e.name);
          if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
          return /\.tsx?$/.test(e.name) ? [p] : [];
        });
      const callers = walk(path.join(process.cwd(), "src")).filter(
        (f) => /encrypted-fields-backfill|from "@\/lib\/reencrypt"/.test(fs.readFileSync(f, "utf8")),
      );
      expect(callers.filter((f) => !f.endsWith("sensitive-fields.ts"))).toEqual([]);
    });
  });

  describe("rotating to a new key", () => {
    const rotate = async (o?: { apply?: boolean }) => (await import("@/lib/reencrypt")).reencryptAll(o);

    it("has nothing to do on one key", async () => {
      const report = await rotate({ apply: true });
      expect(report.found).toEqual({});
      expect(report.rewritten).toBe(0);
    });

    it("a dry run counts and test-decrypts, and writes nothing", async () => {
      const before = await db.sessionNote.findFirstOrThrow({ where: { clientId: a.clientId } });
      process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
      const report = await rotate();
      expect(report.found["SessionNote.content"]).toBe(1);
      expect(report.rewritten).toBe(0);
      expect(report.failed).toEqual([]);
      expect(await db.sessionNote.findFirstOrThrow({ where: { clientId: a.clientId } })).toEqual(before);
    });

    it("moves every encrypted value, and the old key can then go", async () => {
      const { backfillEncryptedFields } = await import("@/lib/encrypted-fields-backfill");
      await backfillEncryptedFields({ copy: true, clear: false });
      await backfillEncryptedFields({ clear: true });

      const oldKey = process.env.NOTES_ENCRYPTION_KEY!;
      process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
      const report = await rotate({ apply: true });
      expect(report.failed).toEqual([]);
      for (const field of [
        "SessionNote.content",
        "SessionFile.data",
        "ClientDocumentBlob.data",
        "SupportRequest.attachment",
        "User.totpSecret",
        "Client.idNumberCiphertext",
        "Client.generalNotesCiphertext",
        "SessionFile.fileNameCiphertext",
        "ClientDocument.nameCiphertext",
        "WaitlistEntry.notesCiphertext",
        "InboxMessage.textCiphertext",
      ]) {
        expect(report.found[field], field).toBeGreaterThan(0);
      }

      // Nothing left, and running it again does nothing
      expect((await rotate()).found).toEqual({});

      // Everything opens with the new key alone
      delete process.env.NOTES_ENCRYPTION_KEY;
      try {
        const { decryptBuffer, decryptNote, decryptSecret } = await import("@/lib/crypto");
        const note = await db.sessionNote.findFirstOrThrow({ where: { clientId: a.clientId } });
        expect(decryptNote(note)).toContain(a.canary);
        const file = await db.sessionFile.findUniqueOrThrow({ where: { id: a.fileId } });
        expect(
          decryptBuffer({ ciphertext: Buffer.from(file.dataCiphertext), iv: file.dataIv, tag: file.dataTag }).equals(PDF_BYTES),
        ).toBe(true);
        const blob = await db.clientDocumentBlob.findUniqueOrThrow({ where: { documentId: a.documentId } });
        expect(decryptBuffer({ ciphertext: Buffer.from(blob.ciphertext), iv: blob.iv, tag: blob.tag }).equals(PDF_BYTES)).toBe(true);
        const u = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
        expect(decryptSecret(u.totpSecret!)).toBe("secret-A");
      } finally {
        process.env.NOTES_ENCRYPTION_KEY = oldKey;
      }
    }, 30_000);

    it("a value that won't decrypt is reported and left alone", async () => {
      await db.sessionNote.updateMany({
        where: { clientId: a.clientId },
        data: { contentTag: Buffer.alloc(16, 1).toString("base64") },
      });
      const before = await db.sessionNote.findFirstOrThrow({ where: { clientId: a.clientId } });
      process.env.NOTES_ENCRYPTION_KEY_V2 = KEY2;
      const report = await rotate({ apply: true });
      expect(report.failed).toEqual([`SessionNote ${before.id}`]);
      expect(await db.sessionNote.findFirstOrThrow({ where: { clientId: a.clientId } })).toEqual(before);
    });
  });
});
