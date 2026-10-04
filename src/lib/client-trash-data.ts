// DB side of the clients' recycle bin (סל מחזור). The rules are in
// client-trash.ts. These read deleted clients, so they use the unfiltered
// `dbAll` — and every query is still scoped by userId (except the scheduled
// purge, which runs for every practice and logs each purge under its owner).

import { dbAll } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { purgeCutoff, type ClientDeletionFacts } from "@/lib/client-trash";

/** What deleting this client would take with it, and what would block it.
 *  `inTrash` picks a client in the bin (permanent delete) or one that isn't. */
export async function loadDeletionFacts(
  userId: string,
  clientId: string,
  inTrash: boolean,
): Promise<(ClientDeletionFacts & { name: string }) | null> {
  const client = await dbAll.client.findFirst({
    where: { id: clientId, userId, deletedAt: inTrash ? { not: null } : null },
    select: { firstName: true, lastName: true, status: true },
  });
  if (!client) return null;
  const mine = { userId, clientId };
  const [sessions, notes, files, invoices, paidSessions, morningOnSessions, morningAssigned] =
    await Promise.all([
      dbAll.session.count({ where: mine }),
      dbAll.sessionNote.count({ where: { clientId, session: { userId } } }),
      dbAll.sessionFile.count({ where: mine }),
      dbAll.invoice.count({ where: mine }),
      dbAll.session.count({
        where: { ...mine, OR: [{ paymentStatus: "PAID" }, { paidAmount: { not: null } }] },
      }),
      dbAll.session.count({
        where: {
          ...mine,
          OR: [
            { morningDocNumber: { not: null } },
            { morningReceiptNumber: { not: null } },
            { morningInvoiceReceiptNumber: { not: null } },
          ],
        },
      }),
      dbAll.morningDocument.count({ where: mine }),
    ]);
  return {
    name: `${client.firstName} ${client.lastName}`.trim(),
    status: client.status,
    sessions,
    notes,
    files,
    invoices,
    paidSessions,
    morningDocs: morningOnSessions + morningAssigned,
  };
}

/**
 * Deletes a client for good, with everything that belongs to them: meetings,
 * encrypted notes, attachments (stored in the database, so they are really
 * gone — there is no file storage to orphan) and reminder jobs, all through
 * ON DELETE CASCADE. Only clients in the bin, and never one holding an app
 * invoice (the FK would refuse anyway). Returns whether it was deleted.
 */
export async function purgeClient(userId: string, clientId: string): Promise<boolean> {
  const { count } = await dbAll.client.deleteMany({
    where: { id: clientId, userId, deletedAt: { not: null }, invoices: { none: {} } },
  });
  if (count > 0) await logAudit(userId, "CLIENT_PURGE", { clientId });
  return count > 0;
}

/**
 * The automatic purge: every client whose 30 days in the bin are over (for one
 * practice, or for all of them from the scheduler). Idempotent — running it
 * twice, or from two places at once, deletes nothing extra.
 */
export async function purgeExpiredClients(now = new Date(), userId?: string): Promise<number> {
  const due = await dbAll.client.findMany({
    where: {
      ...(userId ? { userId } : {}),
      deletedAt: { not: null, lte: purgeCutoff(now) },
    },
    select: { id: true, userId: true },
    take: 200,
  });
  let purged = 0;
  for (const c of due) {
    try {
      if (await purgeClient(c.userId, c.id)) purged++;
    } catch (err) {
      console.error("Client purge failed:", c.id, err);
    }
  }
  return purged;
}
