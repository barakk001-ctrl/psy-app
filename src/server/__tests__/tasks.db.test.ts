import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

// Tasks ("משימות") against a real Postgres: stored encrypted, kept inside the
// practice, gone with their client, and refused on an expired account.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "tasks");
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

describe.skipIf(!TEST_DATABASE_URL)("tasks (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;
  let b: Practice;
  let actions: typeof import("@/server/actions/tasks");
  let data: typeof import("@/lib/tasks-data");

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("tasks");
    db = (await import("@/lib/db")).dbAll;
    actions = await import("@/server/actions/tasks");
    data = await import("@/lib/tasks-data");
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    b = await seedPractice(db, "B");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  const add = (fields: Record<string, string>) => actions.addTaskAction(null, form(fields));

  it("stores the title and the note encrypted, and reads them back", async () => {
    expect(
      await add({
        title: "שיחה עם הצוות החינוכי",
        note: "לתאם עם היועצת",
        dueDay: "2026-11-20",
        clientId: a.clientId,
      }),
    ).toEqual({ ok: true });
    const row = await db.todo.findFirstOrThrow({ where: { userId: a.userId, id: { not: a.todoId } } });
    expect(row.text).toBe("");
    expect(row.textCiphertext).toBeTruthy();
    expect(row.textCiphertext).not.toContain("שיחה");
    expect(row.noteCiphertext).not.toContain("לתאם");
    expect(row).toMatchObject({
      clientId: a.clientId,
      dueDay: "2026-11-20",
      source: "MANUAL",
      awaitingApproval: false,
      done: false,
      doneAt: null,
    });

    const mine = await data.loadOpenTasks(a.userId);
    const task = mine.find((t) => t.id === row.id)!;
    expect(task).toMatchObject({
      title: "שיחה עם הצוות החינוכי",
      note: "לתאם עם היועצת",
      dueDay: "2026-11-20",
      source: "MANUAL",
    });
    expect(task.client?.id).toBe(a.clientId);
  });

  it("a task with no client, note or day is fine, and an empty title is not", async () => {
    expect(await add({ title: "להזמין ציוד" })).toEqual({ ok: true });
    const row = await db.todo.findFirstOrThrow({ where: { userId: a.userId, clientId: null } });
    expect(row).toMatchObject({ dueDay: null, noteCiphertext: null });
    expect((await add({ title: "   " }))?.error).toBeTruthy();
    expect((await add({ title: "משימה", dueDay: "2026-13-45" }))?.error).toBeTruthy();
  });

  it("an older task with a plain title still reads, and editing it moves the title", async () => {
    const old = await db.todo.create({ data: { userId: a.userId, text: "משימה ישנה" } });
    expect((await data.loadOpenTasks(a.userId)).find((t) => t.id === old.id)?.title).toBe("משימה ישנה");
    expect(await actions.updateTaskAction(null, form({ id: old.id, title: "משימה מעודכנת" }))).toEqual({ ok: true });
    const row = await db.todo.findUniqueOrThrow({ where: { id: old.id } });
    expect(row.text).toBe("");
    expect(row.textCiphertext).toBeTruthy();
    expect((await data.loadOpenTasks(a.userId)).find((t) => t.id === old.id)?.title).toBe("משימה מעודכנת");
  });

  it("ticking records when, and unticking clears it", async () => {
    await actions.toggleTaskAction(a.todoId);
    let row = await db.todo.findUniqueOrThrow({ where: { id: a.todoId } });
    expect(row.done).toBe(true);
    expect(row.doneAt).toBeInstanceOf(Date);
    expect((await data.loadDoneTasks(a.userId)).map((t) => t.id)).toContain(a.todoId);
    expect((await data.loadOpenTasks(a.userId)).map((t) => t.id)).not.toContain(a.todoId);

    await actions.toggleTaskAction(a.todoId);
    row = await db.todo.findUniqueOrThrow({ where: { id: a.todoId } });
    expect(row).toMatchObject({ done: false, doneAt: null });
  });

  it("one practice never sees or touches another's tasks", async () => {
    // B's lists hold nothing of A's
    for (const list of [
      await data.loadOpenTasks(b.userId),
      await data.loadDoneTasks(b.userId),
      // asking for A's client by id gives nothing either
      await data.loadOpenTasks(b.userId, a.clientId),
      await data.loadDoneTasks(b.userId, { clientId: a.clientId }),
    ]) {
      expect(JSON.stringify(list)).not.toContain(a.canary);
      expect(list.map((t) => t.id)).not.toContain(a.todoId);
    }
    expect((await data.loadTaskClients(b.userId)).map((c) => c.id)).not.toContain(a.clientId);
    expect(await data.countTasksDueNow(b.userId, "2099-01-01")).toBe(1); // B's own seeded task only

    // B acting on A's task or A's client changes nothing
    mocks.actor.id = b.userId;
    const before = await db.todo.findMany({ where: { userId: a.userId } });
    expect((await add({ title: "פולש", clientId: a.clientId }))?.error).toBe("הלקוח/ה לא נמצא/ה");
    expect((await actions.updateTaskAction(null, form({ id: a.todoId, title: "פולש" })))?.error).toBeTruthy();
    expect(
      (await actions.updateTaskAction(null, form({ id: b.todoId, title: "שלי", clientId: a.clientId })))?.error,
    ).toBe("הלקוח/ה לא נמצא/ה");
    expect((await actions.toggleTaskAction(a.todoId))?.error).toBeTruthy();
    expect((await actions.deleteTaskAction(a.todoId))?.error).toBeTruthy();
    expect(await db.todo.findMany({ where: { userId: a.userId } })).toEqual(before);
    expect(await db.todo.count({ where: { clientId: a.clientId, userId: { not: a.userId } } })).toBe(0);
    // B's own task was not moved to A's client
    expect((await db.todo.findUniqueOrThrow({ where: { id: b.todoId } })).clientId).toBe(b.clientId);
  });

  it("a proposal waiting for approval is in no list and no count", async () => {
    const proposal = await db.todo.create({
      data: { userId: a.userId, text: "הצעה", source: "GUIDE", awaitingApproval: true, dueDay: "2026-01-01" },
    });
    expect((await data.loadOpenTasks(a.userId)).map((t) => t.id)).not.toContain(proposal.id);
    expect(await data.countTasksDueNow(a.userId, "2026-06-01")).toBe(0);
  });

  it("changes to a client's task are in the access log, and a general task's are not", async () => {
    const count = () => db.auditLog.count({ where: { userId: a.userId, action: { in: ["TASK_SAVE", "TASK_DELETE"] } } });
    await add({ title: "כללית" });
    expect(await count()).toBe(0);
    await add({ title: "על הלקוח", clientId: a.clientId });
    expect(await count()).toBe(1);
    await actions.toggleTaskAction(a.todoId);
    expect(await count()).toBe(2);
    await actions.deleteTaskAction(a.todoId);
    expect(await count()).toBe(3);
    const last = await db.auditLog.findFirstOrThrow({
      where: { userId: a.userId, action: "TASK_DELETE" },
    });
    expect(last.clientId).toBe(a.clientId);
  });

  it("a client in the recycle bin hides its tasks, and deleting the client for good removes them", async () => {
    await add({ title: "כללית" });
    await db.client.update({
      where: { id: a.clientId },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    const open = await data.loadOpenTasks(a.userId);
    expect(open.map((t) => t.id)).not.toContain(a.todoId);
    expect(open.map((t) => t.title)).toContain("כללית");
    expect(await data.countTasksDueNow(a.userId, "2099-01-01")).toBe(0);
    // and it can't be changed while it is hidden
    expect((await actions.toggleTaskAction(a.todoId))?.error).toBeTruthy();
    expect((await actions.deleteTaskAction(a.todoId))?.error).toBeTruthy();
    expect(await db.todo.count({ where: { id: a.todoId } })).toBe(1);

    // "מחיקה לצמיתות" of a client in the recycle bin takes its tasks with it
    // (a client with no tax records: the seeded one has invoices and stays)
    const gone = await db.client.create({
      data: { userId: a.userId, firstName: "נמחקת", lastName: "בדויה", status: "INACTIVE", deletedAt: new Date() },
    });
    const task = await db.todo.create({ data: { userId: a.userId, clientId: gone.id, text: "משימה של התיק" } });
    const { purgeClientNowAction } = await import("@/server/actions/clients");
    expect(await purgeClientNowAction(form({ id: gone.id }))).toEqual({ done: true });
    expect(await db.client.count({ where: { id: gone.id } })).toBe(0);
    expect(await db.todo.count({ where: { id: task.id } })).toBe(0);
    // the general one and the other client's stay
    expect(await db.todo.count({ where: { userId: a.userId } })).toBe(2);
  });

  it("deleting the account removes every task", async () => {
    await add({ title: "כללית" });
    await db.user.delete({ where: { id: a.userId } });
    expect(await db.todo.count({ where: { userId: a.userId } })).toBe(0);
    expect(await db.todo.count({ where: { userId: b.userId } })).toBe(1);
  });

  it("refuses everything on an expired account", async () => {
    await db.user.update({
      where: { id: a.userId },
      data: {
        subscriptionExempt: false,
        subscriptionPlan: "MONTHLY",
        subscriptionEndsAt: new Date(Date.now() - 86_400_000),
        trialEndsAt: new Date(Date.now() - 86_400_000),
      },
    });
    const before = await db.todo.findMany({ where: { userId: a.userId } });
    for (const r of [
      await add({ title: "חדשה" }),
      await actions.updateTaskAction(null, form({ id: a.todoId, title: "אחרת" })),
      await actions.toggleTaskAction(a.todoId),
      await actions.deleteTaskAction(a.todoId),
    ]) {
      expect(r?.error).toBeTruthy();
    }
    expect(await db.todo.findMany({ where: { userId: a.userId } })).toEqual(before);
    // reading still works
    expect((await data.loadOpenTasks(a.userId)).map((t) => t.id)).toContain(a.todoId);
  });
});
