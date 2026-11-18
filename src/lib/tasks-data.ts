// The database side of tasks ("משימות", rules in tasks.ts). Every read is
// scoped by the signed-in user's id and goes through `db`, so a task about a
// client in the recycle bin is hidden with the client (trash-filter.ts).
// Proposals of the personal guide that she has not accepted yet
// (awaitingApproval) are never part of a list.

import { db } from "@/lib/db";
import { taskNote, taskTitle } from "@/lib/sensitive-fields";
import type { TaskSource } from "@/lib/tasks";
import type { ClientChoice } from "@/lib/follow-up-filters";

/** A task as the screens get it: decrypted, dates as text. */
export type TaskView = {
  id: string;
  title: string;
  note: string | null;
  dueDay: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  client: { id: string; name: string } | null;
  source: TaskSource;
};

const SELECT = {
  id: true,
  text: true,
  textCiphertext: true,
  noteCiphertext: true,
  dueDay: true,
  done: true,
  doneAt: true,
  createdAt: true,
  source: true,
  client: { select: { id: true, firstName: true, lastName: true } },
} as const;

type Row = {
  id: string;
  text: string;
  textCiphertext: string | null;
  noteCiphertext: string | null;
  dueDay: string | null;
  done: boolean;
  doneAt: Date | null;
  createdAt: Date;
  source: string;
  client: { id: string; firstName: string; lastName: string } | null;
};

function view(row: Row): TaskView {
  return {
    id: row.id,
    title: taskTitle(row),
    note: taskNote(row),
    dueDay: row.dueDay,
    done: row.done,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    client: row.client
      ? { id: row.client.id, name: `${row.client.firstName} ${row.client.lastName}`.trim() }
      : null,
    source: row.source === "GUIDE" ? "GUIDE" : "MANUAL",
  };
}

/** The open tasks of a practice, or of one of its clients. */
export async function loadOpenTasks(userId: string, clientId?: string): Promise<TaskView[]> {
  const rows = await db.todo.findMany({
    where: { userId, done: false, awaitingApproval: false, ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: SELECT,
  });
  return rows.map(view);
}

/** The tasks already ticked, the latest first. */
export async function loadDoneTasks(
  userId: string,
  opts: { clientId?: string; since?: Date; take?: number } = {},
): Promise<TaskView[]> {
  const rows = await db.todo.findMany({
    where: {
      userId,
      done: true,
      awaitingApproval: false,
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.since ? { doneAt: { gte: opts.since } } : {}),
    },
    orderBy: [{ doneAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: opts.take ?? 50,
    select: SELECT,
  });
  return rows.map(view);
}

/** The number on the menu: open tasks due today or earlier ("yyyy-MM-dd" sorts as text). */
export async function countTasksDueNow(userId: string, today: string): Promise<number> {
  return db.todo.count({
    where: { userId, done: false, awaitingApproval: false, dueDay: { lte: today } },
  });
}

/** The practice's clients for the task form's picker, active ones first. */
export async function loadTaskClients(userId: string): Promise<ClientChoice[]> {
  const clients = await db.client.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  return clients.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    active: c.status === "ACTIVE",
  }));
}
