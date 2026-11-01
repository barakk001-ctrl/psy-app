// DB side of closing an account (rules: account-closure.ts). `closeAccount` is
// reached only from closeAccountAction. The purge is the one place that deletes
// a whole account.

import { dbAll } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { CLOSURE_GRACE_DAYS, isAccountPurgeDue, purgeDate } from "@/lib/account-closure";
import { buildAccountPurgedEmail } from "@/lib/account-closure-email";
import { scheduleSessionReminders } from "@/lib/reminders";

/** Closes the account now. False if it was already closed, or is the operator's. */
export async function closeAccount(userId: string, now = new Date()): Promise<Date | null> {
  const purgeAfter = purgeDate(now);
  const closed = await dbAll.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, closedAt: null, isAdmin: false },
      data: { closedAt: now, purgeAfter, exportGrantHash: null, exportGrantExpiresAt: null },
    });
    if (count === 0) return false;
    // No client hears from a closed practice
    await tx.reminderJob.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: "CANCELLED", error: "Account closed" },
    });
    return true;
  });
  if (!closed) return null;
  await logAudit(userId, "ACCOUNT_CLOSE");
  return purgeAfter;
}

/** Back as it was, while the grace period lasts; reminders of future meetings set up again. */
export async function restoreAccount(userId: string, now = new Date()): Promise<boolean> {
  const { count } = await dbAll.user.updateMany({
    where: { id: userId, closedAt: { not: null }, purgeAfter: { gt: now } },
    data: { closedAt: null, purgeAfter: null },
  });
  if (count === 0) return false;

  const upcoming = await dbAll.session.findMany({
    where: { userId, status: "SCHEDULED", startsAt: { gt: now }, client: { deletedAt: null } },
    select: { id: true },
  });
  for (const s of upcoming) await scheduleSessionReminders(s.id);
  await logAudit(userId, "ACCOUNT_RESTORE");
  return true;
}

/**
 * Deletes everything of one user, for good. The first statement takes the row
 * lock and re-checks that the account is still due, so a restore racing this
 * either wins (nothing is deleted) or waits and finds nothing to restore.
 *
 * Order matters: Invoice → Client is ON DELETE RESTRICT, so invoices go first.
 * Then deleting the user cascades through every table with a foreign key to it
 * (clients, meetings, notes, files, documents and their blobs in Postgres). An
 * object-store backend for documents would need explicit deletes here, see
 * document-storage.ts.
 *
 * Tables with no foreign key are handled by hand. Audit entries and checkouts
 * are deleted. A BillingEvent is the operator's own record of a payment
 * received, which tax law says to keep, so it stays with the account's id and
 * the provider's raw payload removed. One ACCOUNT_PURGE row stays, holding only
 * the now meaningless id, as the proof that the deletion ran.
 */
export async function purgeAccount(userId: string, now = new Date()): Promise<boolean> {
  const purged = await dbAll.$transaction(
    async (tx) => {
      const due = await tx.user.updateMany({
        where: { id: userId, closedAt: { not: null }, purgeAfter: { lte: now }, isAdmin: false },
        data: { exportGrantHash: null },
      });
      if (due.count === 0) return null;
      const who = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true },
      });
      await tx.invoice.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.growCheckout.deleteMany({ where: { userId } });
      await tx.inviteCode.deleteMany({ where: { createdById: userId } });
      await tx.billingEvent.updateMany({ where: { userId }, data: { userId: null, raw: null } });
      await tx.user.delete({ where: { id: userId } });
      await tx.auditLog.create({ data: { userId, action: "ACCOUNT_PURGE" } });
      return who;
    },
    { timeout: 120_000 },
  );
  if (!purged) return false;
  await sendEmail({ to: purged.email, ...buildAccountPurgedEmail({ name: purged.name }) });
  return true;
}

/** Hourly: every account whose grace period is over. Idempotent. */
export async function purgeClosedAccounts(now = new Date()): Promise<number> {
  const rows = await dbAll.user.findMany({
    where: { closedAt: { not: null }, purgeAfter: { lte: now }, isAdmin: false },
    select: { id: true, closedAt: true, purgeAfter: true, isAdmin: true },
    take: 20,
  });
  let purged = 0;
  for (const u of rows) {
    if (!isAccountPurgeDue(u, now)) continue;
    try {
      if (await purgeAccount(u.id, now)) purged++;
    } catch (err) {
      console.error("Account purge failed:", u.id, err instanceof Error ? err.name : "error");
    }
  }
  return purged;
}

/** For the operator's card in Settings. */
export async function pendingClosures(now = new Date()) {
  const rows = await dbAll.user.findMany({
    where: { closedAt: { not: null } },
    orderBy: { purgeAfter: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      closedAt: true,
      purgeAfter: true,
      subscriptionExempt: true,
    },
  });
  return rows.map((r) => ({ ...r, now, graceDays: CLOSURE_GRACE_DAYS }));
}
