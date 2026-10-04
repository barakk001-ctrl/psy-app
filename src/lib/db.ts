import { PrismaClient } from "@prisma/client";
import { withLiveFilter } from "@/lib/trash-filter";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * The raw client — it also sees clients in the recycle bin (סל מחזור). Use it
 * only for the bin itself: listing, restoring and purging deleted clients
 * (client-trash-data.ts). Everything else uses `db`.
 */
export const dbAll =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = dbAll;

/**
 * The app's client. Every read of clients and of what belongs to them
 * (meetings, notes, files, reminder jobs) leaves out clients in the recycle
 * bin, so a deleted client vanishes from lists, pickers, the calendar, the ICS
 * feed, dashboards, reports and reminders without each query having to
 * remember it (rules: trash-filter.ts).
 */
export const db = dbAll.$extends({
  name: "hide-deleted-clients",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(withLiveFilter(model, operation, args));
      },
    },
  },
});

/** The client inside `db.$transaction(async (tx) => …)`. */
export type DbTx = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
