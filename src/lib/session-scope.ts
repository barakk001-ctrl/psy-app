// DB side of "this meeting only / all of this client's meetings": loads the
// meetings the pure rules in standing-slot.ts and bulk-delete.ts decide on.
// Every query is scoped by userId.

import { db, type DbTx } from "@/lib/db";
import { seriesRootOf, standingSlotFollowers } from "@/lib/standing-slot";
import { planFutureDelete, type BulkDeletePlan } from "@/lib/bulk-delete";
import { buildRecurrenceRule, isOpenEndedRule } from "@/lib/recurrence";
import {
  closeRecurrenceRule,
  planDeactivation,
  type DeactivationCandidate,
  type DeactivationPlan,
} from "@/lib/client-deactivation";

type Anchor = {
  id: string;
  clientId: string;
  startsAt: Date;
  parentSessionId: string | null;
  recurrenceRule: string | null;
};

/** The client's following meetings in the same standing slot as `anchor`. */
export async function loadSlotFollowers(userId: string, anchor: Anchor, now = new Date()) {
  const after = new Date(Math.max(anchor.startsAt.getTime(), now.getTime()));
  const rows = await db.session.findMany({
    where: {
      userId,
      clientId: anchor.clientId,
      status: "SCHEDULED",
      startsAt: { gt: after },
      id: { not: anchor.id },
    },
    select: {
      id: true,
      clientId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      parentSessionId: true,
      recurrenceRule: true,
    },
    orderBy: { startsAt: "asc" },
  });
  return standingSlotFollowers(
    {
      id: anchor.id,
      clientId: anchor.clientId,
      startsAt: anchor.startsAt,
      seriesRootId: seriesRootOf(anchor),
    },
    rows.map((r) => ({ ...r, seriesRootId: seriesRootOf(r) })),
    now,
  );
}

/** The client's meetings that start after now, as the pure planners take them. */
async function loadFutureCandidates(
  userId: string,
  clientId: string,
  now: Date,
): Promise<DeactivationCandidate[]> {
  const rows = await db.session.findMany({
    where: { userId, clientId, startsAt: { gt: now } },
    select: {
      id: true,
      startsAt: true,
      status: true,
      paymentStatus: true,
      paidAmount: true,
      morningDocNumber: true,
      morningReceiptNumber: true,
      morningInvoiceReceiptNumber: true,
      note: { select: { id: true } },
      invoiceItem: { select: { id: true } },
      _count: { select: { files: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    status: r.status,
    hasNote: !!r.note,
    fileCount: r._count.files,
    hasInvoiceItem: !!r.invoiceItem,
    paymentStatus: r.paymentStatus,
    paidAmount: r.paidAmount,
    morningDocNumber: r.morningDocNumber,
    morningReceiptNumber: r.morningReceiptNumber,
    morningInvoiceReceiptNumber: r.morningInvoiceReceiptNumber,
  }));
}

/** What "delete all of this client's future meetings" would do right now. */
export async function loadFutureDeletePlan(
  userId: string,
  clientId: string,
  now = new Date(),
): Promise<BulkDeletePlan & { scheduledKeepIds: string[] }> {
  const rows = await loadFutureCandidates(userId, clientId, now);
  const plan = planFutureDelete(rows, now);
  const keepIds = new Set(plan.keep.map((k) => k.id));
  const scheduledKeepIds = rows
    .filter((r) => keepIds.has(r.id) && r.status === "SCHEDULED")
    .map((r) => r.id);
  return { ...plan, scheduledKeepIds };
}

/** What marking this client "לא פעיל" would do to the calendar right now. */
export async function loadDeactivationPlan(
  userId: string,
  clientId: string,
  now = new Date(),
): Promise<DeactivationPlan> {
  return planDeactivation(await loadFutureCandidates(userId, clientId, now), now);
}

/**
 * Ends every open-ended (קבוע) series of the client at the meetings it has,
 * so the cron never extends it — not even after the client is reactivated.
 * Run after the deletes (keepSeriesLinked may have promoted a new root).
 */
export async function closeClientOpenSeries(
  tx: DbTx,
  userId: string,
  clientId: string,
): Promise<void> {
  const roots = await tx.session.findMany({
    where: { userId, clientId, parentSessionId: null, recurrenceRule: { not: null } },
    select: { id: true, recurrenceRule: true, _count: { select: { childSessions: true } } },
  });
  for (const r of roots) {
    if (!isOpenEndedRule(r.recurrenceRule)) continue;
    await tx.session.update({
      where: { id: r.id },
      data: { recurrenceRule: closeRecurrenceRule(r.recurrenceRule!, r._count.childSessions + 1) },
    });
  }
}

/**
 * Before deleting meetings, hand each deleted series parent's role to its
 * earliest surviving meeting. `parentSessionId` is ON DELETE SET NULL, so
 * deleting the first meeting of a series used to cut every later meeting
 * loose — they stopped counting as a series (no "all following" choice, no
 * open-ended top-up).
 */
export async function keepSeriesLinked(
  tx: DbTx,
  userId: string,
  deletingIds: string[],
): Promise<void> {
  if (deletingIds.length === 0) return;
  const parents = await tx.session.findMany({
    where: { userId, id: { in: deletingIds }, childSessions: { some: {} } },
    select: { id: true, recurrenceRule: true },
  });
  for (const p of parents) {
    const survivors = await tx.session.findMany({
      where: { userId, parentSessionId: p.id, id: { notIn: deletingIds } },
      select: { id: true },
      orderBy: { startsAt: "asc" },
    });
    if (survivors.length === 0) continue;
    const [heir, ...rest] = survivors;
    await tx.session.update({
      where: { id: heir.id },
      data: {
        parentSessionId: null,
        recurrenceRule: p.recurrenceRule ?? buildRecurrenceRule(1, survivors.length),
      },
    });
    if (rest.length) {
      await tx.session.updateMany({
        where: { userId, id: { in: rest.map((r) => r.id) } },
        data: { parentSessionId: heir.id },
      });
    }
  }
}
