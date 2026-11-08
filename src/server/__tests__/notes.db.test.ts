// Saving a session summary on a real Postgres: the version check that keeps an
// older tab or device from overwriting a newer save (src/lib/note-autosave.ts).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "notes");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null }, revalidated: [] as string[] };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void mocks.revalidated.push(p) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.skipIf(!TEST_DATABASE_URL)("saving a session summary (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("notes");
    db = (await import("@/lib/db")).dbAll;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    mocks.actor.id = a.userId;
    mocks.revalidated.length = 0;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  const save = async (fields: Record<string, string>) => {
    const { saveNoteAction } = await import("@/server/actions/notes");
    return saveNoteAction(null, form({ sessionId: a.sessionId, ...fields }));
  };
  const stored = async () => {
    const { decryptNote } = await import("@/lib/crypto");
    const n = await db.sessionNote.findUnique({ where: { sessionId: a.sessionId } });
    return n ? { text: decryptNote(n), version: n.updatedAt.toISOString() } : null;
  };
  const saves = () => db.auditLog.count({ where: { userId: a.userId, action: "NOTE_SAVE" } });

  it("saves onto the version it was based on, encrypted and logged, and returns the new one", async () => {
    const before = (await stored())!;
    const r = await save({ content: "נוסח ראשון", baseVersion: before.version, auto: "1" });
    expect(r).toMatchObject({ saved: true });
    const after = (await stored())!;
    expect(after.text).toBe("נוסח ראשון");
    expect(r?.version).toBe(after.version);
    expect(after.version).not.toBe(before.version);
    const row = await db.sessionNote.findUniqueOrThrow({ where: { sessionId: a.sessionId } });
    expect(row.contentCiphertext).not.toContain("נוסח");
    expect(await saves()).toBe(1);
    // the automatic save doesn't refresh the page; a manual one does
    expect(mocks.revalidated).toEqual([]);
    await save({ content: "נוסח שני", baseVersion: r!.version! });
    expect(mocks.revalidated).toEqual([`/sessions/${a.sessionId}`]);
  });

  it("never overwrites a newer save with older text", async () => {
    const base = (await stored())!.version;
    // Tab 1 saves
    const first = await save({ content: "מהטלפון, חדש יותר", baseVersion: base, auto: "1" });
    expect(first?.saved).toBe(true);
    // Tab 2 still has the old version
    const second = await save({ content: "מהמחשב, ישן", baseVersion: base, auto: "1" });
    expect(second).toMatchObject({ conflict: true, currentVersion: first!.version });
    expect(second?.saved).toBeUndefined();
    expect((await stored())!.text).toBe("מהטלפון, חדש יותר");
    expect(await saves()).toBe(1);
    // …until it chooses to replace exactly the version it was shown
    const forced = await save({ content: "מהמחשב, ישן", baseVersion: second!.currentVersion! });
    expect(forced?.saved).toBe(true);
    expect((await stored())!.text).toBe("מהמחשב, ישן");
  });

  it("a note created meanwhile isn't replaced by a tab that saw none", async () => {
    await db.sessionNote.deleteMany({ where: { sessionId: a.sessionId } });
    expect((await save({ content: "ראשון", baseVersion: "" }))?.saved).toBe(true);
    const r = await save({ content: "שני", baseVersion: "" });
    expect(r?.conflict).toBe(true);
    expect((await stored())!.text).toBe("ראשון");
  });

  it("emptying deletes only the version that was shown", async () => {
    const base = (await stored())!.version;
    const newer = await save({ content: "נוסח חדש", baseVersion: base });
    expect((await save({ content: "", baseVersion: base }))?.conflict).toBe(true);
    expect((await stored())!.text).toBe("נוסח חדש");
    expect((await save({ content: "", baseVersion: newer!.version! }))?.saved).toBe(true);
    expect(await stored()).toBeNull();
  });

  it("refuses a version that isn't one, and someone else's meeting", async () => {
    expect((await save({ content: "x", baseVersion: "not-a-date" }))?.error).toBeTruthy();
    const b = await seedPractice(db, "B");
    mocks.actor.id = b.userId;
    const r = await save({ content: "x", baseVersion: "" });
    expect(r?.error).toBe("פגישה לא נמצאה");
    mocks.actor.id = a.userId;
    expect((await stored())!.text).toContain("סיכום");
  });

  it("an older page that sends no version still saves, as before", async () => {
    expect((await save({ content: "בלי גרסה" }))?.saved).toBe(true);
    expect((await stored())!.text).toBe("בלי גרסה");
  });
});
