// A client in the recycle bin (סל מחזור, Client.deletedAt set) must vanish
// from everything: lists, pickers, calendar, the ICS feed, dashboards,
// reports, reminders and the series top-up. Rather than remembering a filter
// in every query, `db` (lib/db.ts) runs every read through `withLiveFilter`,
// which adds "the client is not deleted" to the where clause of the models
// that belong to a client. Only the trash itself (list, restore, purge) reads
// deleted clients, through the unfiltered `dbAll`.
//
// Writes are not filtered: they are always preceded by a (filtered) lookup.

const READ_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const LIVE_CLIENT = { deletedAt: null };

/** The where fragment that keeps a model's rows of deleted clients out. */
export function liveFilterFor(model: string | undefined): Record<string, unknown> | null {
  switch (model) {
    case "Client":
      return LIVE_CLIENT;
    case "Session":
    case "SessionNote":
    case "SessionFile":
      return { client: LIVE_CLIENT };
    case "ReminderJob":
      return { session: { client: LIVE_CLIENT } };
    default:
      // Invoices, payments and Morning documents: a client holding any of
      // them can't be deleted (client-trash.ts), so there is nothing to hide.
      return null;
  }
}

type Args = { where?: Record<string, unknown> } & Record<string, unknown>;

/**
 * The query args with the live-client condition added (ANDed, so an existing
 * `client: {...}` condition or the unique keys of a findUnique stay intact).
 */
export function withLiveFilter<T>(model: string | undefined, operation: string, args: T): T {
  if (!READ_OPERATIONS.has(operation)) return args;
  const filter = liveFilterFor(model);
  if (!filter) return args;
  const a = (args ?? {}) as Args;
  const where = a.where ?? {};
  const and = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
  return { ...a, where: { ...where, AND: [...and, filter] } } as T;
}
