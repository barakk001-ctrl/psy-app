"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sealTaskTitle, sealText } from "@/lib/sensitive-fields";
import { isReadOnly } from "@/lib/subscription-server";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { taskSchema } from "@/server/validators/task";

// Tasks ("משימות", rules in src/lib/tasks.ts). The title and the note are
// stored encrypted. A task may be about a client: that client must be one of
// the signed-in practice's own, and every change to such a task (ticking it
// included) is in the access log (TASK_SAVE / TASK_DELETE).

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type TaskFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

function parse(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title") ?? "",
    note: formData.get("note") ?? "",
    dueDay: formData.get("dueDay") ?? "",
    clientId: formData.get("clientId") ?? "",
  });
}

/** The practice's own client with this id (never one in the recycle bin), or null. */
async function ownClientId(userId: string, clientId: string): Promise<string | null> {
  const client = await db.client.findFirst({ where: { id: clientId, userId }, select: { id: true } });
  return client?.id ?? null;
}

function revalidateTasks(clientIds: (string | null | undefined)[]) {
  // The menu's count lives in the layout, so everything under it is refreshed
  revalidatePath("/", "layout");
  for (const id of new Set(clientIds)) if (id) revalidatePath(`/clients/${id}`);
}

/** Adds a task: a title, and optionally a note, a day and a client. */
export async function addTaskAction(_: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "אנא תקנו את השגיאות בטופס", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { title, note, dueDay, clientId } = parsed.data;
  let client: string | null = null;
  if (clientId) {
    client = await ownClientId(userId, clientId);
    if (!client) return { error: "הלקוח/ה לא נמצא/ה" };
  }
  await db.todo.create({
    data: {
      userId,
      ...sealTaskTitle(title),
      noteCiphertext: sealText(note),
      dueDay: dueDay || null,
      clientId: client,
      source: "MANUAL",
    },
  });
  if (client) await logAudit(userId, "TASK_SAVE", { clientId: client });
  revalidateTasks([client]);
  return { ok: true };
}

/** Edits a task's title, note, day and client. */
export async function updateTaskAction(_: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const id = String(formData.get("id") ?? "");
  const existing = id
    ? await db.todo.findFirst({ where: { id, userId }, select: { id: true, clientId: true } })
    : null;
  if (!existing) return { error: "המשימה לא נמצאה" };
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "אנא תקנו את השגיאות בטופס", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { title, note, dueDay, clientId } = parsed.data;
  let client: string | null = null;
  if (clientId) {
    client = await ownClientId(userId, clientId);
    if (!client) return { error: "הלקוח/ה לא נמצא/ה" };
  }
  await db.todo.updateMany({
    where: { id: existing.id, userId },
    data: {
      ...sealTaskTitle(title),
      noteCiphertext: sealText(note),
      dueDay: dueDay || null,
      clientId: client,
    },
  });
  for (const c of new Set([existing.clientId, client])) {
    if (c) await logAudit(userId, "TASK_SAVE", { clientId: c });
  }
  revalidateTasks([existing.clientId, client]);
  return { ok: true };
}

/** Ticks a task done, or brings it back. */
export async function toggleTaskAction(id: string): Promise<TaskFormState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const task = await db.todo.findFirst({
    where: { id, userId },
    select: { id: true, done: true, clientId: true },
  });
  if (!task) return { error: "המשימה לא נמצאה" };
  await db.todo.updateMany({
    where: { id: task.id, userId },
    data: { done: !task.done, doneAt: task.done ? null : new Date() },
  });
  if (task.clientId) await logAudit(userId, "TASK_SAVE", { clientId: task.clientId });
  revalidateTasks([task.clientId]);
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<TaskFormState> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const task = await db.todo.findFirst({ where: { id, userId }, select: { id: true, clientId: true } });
  if (!task) return { error: "המשימה לא נמצאה" };
  await db.todo.deleteMany({ where: { id: task.id, userId } });
  if (task.clientId) await logAudit(userId, "TASK_DELETE", { clientId: task.clientId });
  revalidateTasks([task.clientId]);
  return { ok: true };
}
