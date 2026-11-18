// Tasks ("משימות"): the practitioner's own to-do list. A task has a title, and
// optionally a note, a client it is about and a day it is due. They are shown
// on the dashboard, on the client's page and on /tasks, and the menu counts the
// ones due today or earlier. Nothing is sent anywhere: a "reminder" is the app
// showing the task where she already looks.
//
// The rules here are pure; the database side is src/lib/tasks-data.ts and
// src/server/actions/todos.ts (the table is still called Todo).

import { addDays } from "@/lib/scheduling-window";

/** 300 was the limit of the first to-do list, so every existing title can still be edited. */
export const TASK_TITLE_MAX = 300;
export const TASK_NOTE_MAX = 2000;

/** Who wrote a task. Only MANUAL is written today; GUIDE is for the personal guide. */
export const TASK_SOURCES = ["MANUAL", "GUIDE"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

/** One-tap starting titles; tapping one fills the title, which stays editable. */
export const TASK_SUGGESTIONS = [
  "שיחה עם הצוות החינוכי",
  "קביעת פגישת הורים",
  "שיחה עם גורם מטפל נוסף",
  "כתיבת דוח או חוות דעת",
  "מעקב",
] as const;

/** How far ahead "בקרוב" looks on the dashboard, in days after today. */
export const TASKS_SOON_DAYS = 7;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written "yyyy-MM-dd" (2026-02-30 is not one). */
export function isDay(value: string): boolean {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Whole days from `from` to `to` (both "yyyy-MM-dd"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "none";

/** Where an open task stands against today (both on the clinic calendar). */
export function taskBucket(dueDay: string | null, today: string): TaskBucket {
  if (!dueDay) return "none";
  if (dueDay < today) return "overdue";
  return dueDay === today ? "today" : "upcoming";
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "24.11", with the year only when it isn't today's. */
function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const base = `${d}.${m}`;
  return day.slice(0, 4) === today.slice(0, 4) ? base : `${base}.${String(y).slice(2)}`;
}

/**
 * The due day as she would say it: "היום", "מחר", "אתמול", "לפני 3 ימים",
 * "יום שלישי, 24.11" for the coming week, and the plain date further out.
 */
export function dueText(dueDay: string, today: string): string {
  const diff = daysBetween(today, dueDay);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === -1) return "אתמול";
  if (diff === -2) return "שלשום";
  if (diff < 0) return `לפני ${-diff} ימים`;
  const date = shortDay(dueDay, today);
  if (diff <= 6) {
    const [y, m, d] = dueDay.split("-").map(Number);
    return `יום ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${date}`;
  }
  return date;
}

type Sortable = { dueDay: string | null; createdAt: Date | string };

const time = (v: Date | string) => (typeof v === "string" ? Date.parse(v) : v.getTime());

/** Open tasks in reading order: by day (earliest first), then the undated ones, newest first. */
export function sortOpenTasks<T extends Sortable>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDay && b.dueDay) return a.dueDay.localeCompare(b.dueDay) || time(b.createdAt) - time(a.createdAt);
    if (a.dueDay) return -1;
    if (b.dueDay) return 1;
    return time(b.createdAt) - time(a.createdAt);
  });
}

export type TaskGroups<T> = { overdue: T[]; today: T[]; upcoming: T[]; none: T[] };

/** Open tasks split by where they stand against today, each group in reading order. */
export function groupTasks<T extends Sortable>(tasks: readonly T[], today: string): TaskGroups<T> {
  const groups: TaskGroups<T> = { overdue: [], today: [], upcoming: [], none: [] };
  for (const t of sortOpenTasks(tasks)) groups[taskBucket(t.dueDay, today)].push(t);
  return groups;
}

export const TASK_GROUP_LABELS: Record<TaskBucket, string> = {
  overdue: "באיחור",
  today: "היום",
  upcoming: "בהמשך",
  none: "ללא תאריך",
};

/**
 * What the dashboard box shows: everything overdue or due today, what is due
 * in the coming week, and the undated ones; later dates wait on /tasks. The
 * count of what was left out is returned for the "לכל המשימות" link.
 */
export function dashboardTasks<T extends Sortable>(
  tasks: readonly T[],
  today: string,
  limit = 8,
): { groups: TaskGroups<T>; shown: number; hidden: number } {
  const all = groupTasks(tasks, today);
  const horizon = addDays(today, TASKS_SOON_DAYS);
  const groups: TaskGroups<T> = { overdue: [], today: [], upcoming: [], none: [] };
  let shown = 0;
  const take = (bucket: TaskBucket, rows: T[]) => {
    for (const row of rows) {
      if (shown >= limit) return;
      groups[bucket].push(row);
      shown++;
    }
  };
  take("overdue", all.overdue);
  take("today", all.today);
  take("upcoming", all.upcoming.filter((t) => t.dueDay! <= horizon));
  take("none", all.none);
  return { groups, shown, hidden: tasks.length - shown };
}

/** The number on the menu: open tasks due today or earlier. */
export function dueNowCount(tasks: readonly { dueDay: string | null }[], today: string): number {
  return tasks.filter((t) => t.dueDay !== null && t.dueDay <= today).length;
}

/** "9+" past nine, so the badge keeps its size. */
export function badgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}
