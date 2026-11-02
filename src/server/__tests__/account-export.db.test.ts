import bcrypt from "bcryptjs";
import yauzl from "yauzl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_BYTES, seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "account_export");
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

/** Reads the ZIP back with an independent reader: path → bytes. */
function unzip(buf: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const out = new Map<string, Buffer>();
      zip.on("error", reject);
      zip.on("end", () => resolve(out));
      zip.on("entry", (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e) return reject(e);
          const parts: Buffer[] = [];
          stream.on("data", (c: Buffer) => parts.push(c));
          stream.on("end", () => {
            out.set(entry.fileName, Buffer.concat(parts));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

describe.skipIf(!TEST_DATABASE_URL)("full account export (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;
  let b: Practice;

  const prepare = async (typed: string) =>
    (await import("@/server/actions/account")).prepareAccountExportAction(form({ reauth: typed }));

  async function post(grant: string): Promise<Response> {
    const { POST } = await import("@/app/api/account/export/route");
    return POST(
      new Request("http://test.local/api/account/export", { method: "POST", body: form({ grant }) }),
    );
  }

  async function download(): Promise<Map<string, Buffer>> {
    const res = await prepare("סיסמה-בדויה-1");
    if (!("grant" in res)) throw new Error(res.error);
    const out = await post(res.grant);
    expect(out.status).toBe(200);
    return unzip(Buffer.from(await out.arrayBuffer()));
  }

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("account_export");
    db = (await import("@/lib/db")).dbAll;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    b = await seedPractice(db, "B");
    await db.user.update({
      where: { id: a.userId },
      data: { hashedPassword: await bcrypt.hash("סיסמה-בדויה-1", 4) },
    });
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  it("holds the whole practice, decrypted, and nothing of anyone else's", async () => {
    const zip = await download();
    const names = [...zip.keys()];
    for (const n of ["קראו אותי.txt", "חשבון.json", "לקוחות.csv", "פגישות.csv", "סיכומים.csv", "תשלומים.csv", "חשבוניות ומסמכים.csv", "סיכום הייצוא.txt"]) {
      expect(names).toContain(n);
    }

    const all = [...zip.values()].map((v) => v.toString("utf8")).join("\n");
    expect(all).not.toContain(b.canary);

    const csv = (n: string) => zip.get(n)!.toString("utf8");
    expect(csv("לקוחות.csv")).toContain(a.canary);
    expect(csv("לקוחות.csv")).toContain("000000026");
    expect(csv("סיכומים.csv")).toContain(`סיכום ${a.canary}`);
    expect(csv("תשלומים.csv")).toContain("100");
    expect(csv("חשבוניות ומסמכים.csv")).toContain("9001");
    expect(csv("הוצאות.csv")).toContain(`ספק ${a.canary}`);
    expect(csv("רשימת המתנה.csv")).toContain(`רקע ${a.canary}`);
    expect(csv("הודעות נכנסות.csv")).toContain(`הודעה ${a.canary}`);

    const text = names.find((n) => n.startsWith("סיכומים/"))!;
    expect(zip.get(text)!.toString("utf8")).toContain(`סיכום ${a.canary}`);

    const doc = names.find((n) => n.startsWith("מסמכים/"))!;
    expect(doc).toContain(`מסמך-${a.canary}.pdf`);
    expect(zip.get(doc)!.equals(PDF_BYTES)).toBe(true);
    const file = names.find((n) => n.startsWith("קבצי פגישות/"))!;
    expect(zip.get(file)!.equals(PDF_BYTES)).toBe(true);
    expect(zip.get(names.find((n) => n.startsWith("פניות תמיכה/"))!)!.equals(PDF_BYTES)).toBe(true);

    expect(csv("סיכום הייצוא.txt")).toContain("הכול נקרא בהצלחה");
  }, 30_000);

  it("includes clients in the recycle bin and leaves out every secret", async () => {
    const zip = await download();
    expect(zip.get("לקוחות.csv")!.toString("utf8")).toContain(`בסל-${a.canary}`);
    const all = [...zip.values()].map((v) => v.toString("utf8")).join("\n");
    for (const secret of [a.calendarToken, a.inboxToken, a.inboxApiToken, `key-${a.tag}`, "morningApi", "hashedPassword"]) {
      expect(all).not.toContain(secret);
    }
  }, 30_000);

  it("a damaged note is reported in the summary and doesn't lose the rest", async () => {
    await db.sessionNote.updateMany({
      where: { clientId: a.clientId },
      data: { contentTag: Buffer.alloc(16, 1).toString("base64") },
    });
    const zip = await download();
    expect(zip.get("סיכום הייצוא.txt")!.toString("utf8")).toContain("לא ניתן היה לפענח");
    expect(zip.get("לקוחות.csv")!.toString("utf8")).toContain(a.canary);
  }, 30_000);

  it("needs the re-check, and the grant works once, for its own account only", async () => {
    expect(await prepare("סיסמה-שגויה")).toEqual({ error: "הסיסמה שגויה" });
    const res = await prepare("סיסמה-בדויה-1");
    if (!("grant" in res)) throw new Error(res.error);

    mocks.actor.id = b.userId;
    expect((await post(res.grant)).status).toBe(303);

    mocks.actor.id = a.userId;
    expect((await post("not-a-grant")).status).toBe(303);
    const first = await post(res.grant);
    expect(first.status).toBe(200);
    await first.arrayBuffer();
    expect((await post(res.grant)).status).toBe(303);

    mocks.actor.id = null;
    expect((await post(res.grant)).status).toBe(401);
  }, 30_000);

  it("an old grant has expired", async () => {
    const { consumeExportGrant, createExportGrant, EXPORT_GRANT_TTL_MS } = await import("@/lib/account-export");
    const now = new Date();
    const grant = await createExportGrant(a.userId, now);
    expect(await consumeExportGrant(a.userId, grant, new Date(now.getTime() + EXPORT_GRANT_TTL_MS + 1))).toBe(false);
    expect(await consumeExportGrant(a.userId, grant, now)).toBe(true);
  });

  it("is written to the access log", async () => {
    await download();
    expect(await db.auditLog.count({ where: { userId: a.userId, action: "ACCOUNT_EXPORT" } })).toBe(1);
    expect(await db.auditLog.count({ where: { userId: b.userId, action: "ACCOUNT_EXPORT" } })).toBe(0);
  }, 30_000);

  it("works for an expired account", async () => {
    await db.user.update({
      where: { id: a.userId },
      data: {
        subscriptionExempt: false,
        trialEndsAt: new Date("2025-01-01"),
        subscriptionEndsAt: new Date("2025-02-01"),
      },
    });
    const { isReadOnly } = await import("@/lib/subscription-server");
    expect(await isReadOnly(a.userId)).toBe(true);
    expect((await download()).get("לקוחות.csv")!.toString("utf8")).toContain(a.canary);
  }, 30_000);

  it("is limited per hour and to one run per account", async () => {
    const res = [];
    for (let i = 0; i < 4; i++) res.push(await prepare("סיסמה-בדויה-1"));
    expect(res.slice(0, 3).every((r) => "grant" in r)).toBe(true);
    expect(res[3]).toEqual({ error: expect.stringContaining("עד 3 פעמים") });

    const { tryStartExport, MAX_CONCURRENT_EXPORTS } = await import("@/lib/account-export");
    const first = tryStartExport(a.userId);
    expect(first).not.toBeNull();
    expect(tryStartExport(a.userId)).toBeNull();
    const held = Array.from({ length: MAX_CONCURRENT_EXPORTS - 1 }, (_, i) => tryStartExport(`other-${i}`));
    expect(tryStartExport(b.userId)).toBeNull();
    first!();
    held.forEach((r) => r?.());
    const again = tryStartExport(a.userId);
    expect(again).not.toBeNull();
    again!();
  });

  it("streams: a file is loaded only when the reader gets to it", async () => {
    const { Readable } = await import("node:stream");
    const { zipStream } = await import("@/lib/account-export");
    const started: string[] = [];
    const entry = (path: string) => ({
      path,
      compress: false,
      async *body() {
        started.push(path);
        yield Buffer.alloc(4 * 1024 * 1024, 1);
      },
    });
    const stream: InstanceType<typeof Readable> = zipStream([entry("1.bin"), entry("2.bin"), entry("3.bin"), entry("4.bin")]);
    const reader = stream[Symbol.asyncIterator]();
    await reader.next();
    await new Promise((r) => setTimeout(r, 100));
    // The output buffer holds a little; far from all four files were read
    expect(started.length).toBeLessThan(4);
    stream.destroy();
  });
});
