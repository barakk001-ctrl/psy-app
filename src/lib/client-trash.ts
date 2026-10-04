// Deleting a client: the recycle bin (סל מחזור). Pure rules; the DB side is
// client-trash-data.ts and the actions are in server/actions/clients.ts.
//
// - Only an inactive client can be deleted.
// - A client with tax records can't: app invoices, a meeting marked paid (or
//   with an amount paid), or a Morning document (a receipt/invoice number on a
//   meeting, or a synced Morning document assigned to them). Bookkeeping
//   records must be kept, so she keeps such a client inactive instead.
// - Deleting moves the client to the bin for TRASH_DAYS: hidden everywhere,
//   restorable as it was. After that the client and everything that belongs
//   to them (meetings, encrypted notes, attachments, reminder jobs) is purged
//   automatically.

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deleted at or before this moment → due for the permanent purge. */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

export function isPurgeDue(deletedAt: Date | null, now: Date): boolean {
  return !!deletedAt && deletedAt.getTime() <= purgeCutoff(now).getTime();
}

/** Of the clients in the bin, the ones whose 30 days are over. */
export function selectPurgeDue<T extends { deletedAt: Date | null }>(clients: T[], now: Date): T[] {
  return clients.filter((c) => isPurgeDue(c.deletedAt, now));
}

/** Whole days left before the purge (0 = it goes on the next run). */
export function trashDaysLeft(deletedAt: Date, now: Date): number {
  const left = deletedAt.getTime() + TRASH_DAYS * DAY_MS - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / DAY_MS);
}

/** "עוד 12 ימים" / "עוד יום אחד" / "היום" — until the permanent deletion. */
export function daysLeftText(days: number): string {
  if (days <= 0) return "היום";
  if (days === 1) return "עוד יום אחד";
  return `עוד ${days} ימים`;
}

export type ClientDeletionFacts = {
  status: string;
  sessions: number;
  notes: number;
  files: number;
  invoices: number;
  /** meetings marked PAID or with an amount paid */
  paidSessions: number;
  /** Morning numbers typed on meetings + synced Morning documents assigned */
  morningDocs: number;
};

export type DeletionBlocker = "active" | "invoices" | "payments" | "morning";

export const BLOCKER_LABELS: Record<Exclude<DeletionBlocker, "active">, string> = {
  invoices: "חשבוניות שהופקו באפליקציה",
  payments: "רישומי תשלום בפגישות",
  morning: "מסמכי Morning (חשבונית/קבלה)",
};

export type DeletionDecision =
  | { allowed: false; blockers: DeletionBlocker[] }
  | { allowed: true; clinicalWarning: boolean };

export function clientDeletionDecision(f: ClientDeletionFacts): DeletionDecision {
  const blockers: DeletionBlocker[] = [];
  if (f.status !== "INACTIVE") blockers.push("active");
  if (f.invoices > 0) blockers.push("invoices");
  if (f.paidSessions > 0) blockers.push("payments");
  if (f.morningDocs > 0) blockers.push("morning");
  if (blockers.length) return { allowed: false, blockers };
  return { allowed: true, clinicalWarning: f.notes > 0 || f.files > 0 };
}

function count(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** Hebrew list joined with "ו": "3 פגישות, 2 סיכומים וקובץ מצורף אחד". */
function joinHebrew(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  const last = parts[parts.length - 1];
  // "ו-3 סיכומים" but "וקובץ מצורף אחד"
  return `${parts.slice(0, -1).join(", ")} ${/^\d/.test(last) ? "ו-" : "ו"}${last}`;
}

/** What goes with the client: "יחד עם התיק יימחקו: 3 פגישות, 2 סיכומים וקובץ מצורף אחד." */
export function deletionContentsText(f: Pick<ClientDeletionFacts, "sessions" | "notes" | "files">): string {
  const parts: string[] = [];
  if (f.sessions) parts.push(count(f.sessions, "פגישה אחת", "פגישות"));
  if (f.notes) parts.push(count(f.notes, "סיכום אחד", "סיכומים"));
  if (f.files) parts.push(count(f.files, "קובץ מצורף אחד", "קבצים מצורפים"));
  if (parts.length === 0) return "אין בתיק פגישות, סיכומים או קבצים — יימחקו רק פרטי הלקוח/ה.";
  return `יחד עם התיק יימחקו: ${joinHebrew(parts)}.`;
}

/** Why the client can't be deleted, e.g. "חשבוניות שהופקו באפליקציה ורישומי תשלום בפגישות". */
export function blockersText(blockers: DeletionBlocker[]): string {
  return joinHebrew(
    blockers.filter((b): b is Exclude<DeletionBlocker, "active"> => b !== "active").map((b) => BLOCKER_LABELS[b]),
  );
}
