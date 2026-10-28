// Grow (Meshulam) payment callbacks — the decision logic, with its I/O passed
// in so it is testable without Grow or a database (grow-callback.test.ts).
// The route (src/app/api/billing/webhook/route.ts) wires the real deps.
//
// Trust model: the callback is unsigned, so nothing in it is believed on its
// own. It must name a checkout we created (processId); the user, plan and
// amount come from that stored checkout; Grow must confirm the transaction
// under our credentials (approveTransaction); and a checkout is applied once
// (PENDING → APPLIED, atomically). An unverified callback is only logged — it
// never blocks the real callback that follows.

export type GrowPlan = "MONTHLY" | "YEARLY";

export type StoredCheckout = {
  id: string;
  userId: string;
  plan: GrowPlan;
  sum: number;
  processId: string;
  processToken: string | null;
  status: "PENDING" | "APPLIED";
};

export type GrowCallbackDeps = {
  findCheckout(processId: string): Promise<StoredCheckout | null>;
  /** Grow's approveTransaction under our credentials */
  approve(args: {
    transactionId: string;
    transactionToken?: string;
    processId: string;
    processToken?: string;
    sum: string;
  }): Promise<boolean>;
  /** PENDING → APPLIED; true only for the call that made the switch */
  markApplied(checkoutId: string, transactionId: string): Promise<boolean>;
  extend(userId: string, plan: GrowPlan): Promise<unknown>;
  record(event: {
    transactionId: string;
    userId: string | null;
    plan: GrowPlan | null;
    amount: number | null;
    status: "VERIFIED" | "UNVERIFIED" | "DUPLICATE";
  }): Promise<unknown>;
};

export type GrowCallbackResult =
  | { status: 400; body: { error: string } }
  | { status: 200; body: { ok: true; held?: true; duplicate?: true } };

type Fields = Record<string, string>;

function pick(fields: Fields, ...names: string[]): string | undefined {
  return names.map((n) => fields[n]).find((v) => v !== undefined && v !== "");
}

export async function handleGrowCallback(fields: Fields, deps: GrowCallbackDeps): Promise<GrowCallbackResult> {
  const transactionId = pick(fields, "transactionId", "data[transactionId]", "asmachta");
  if (!transactionId) return { status: 400, body: { error: "no transaction" } };
  const processId = pick(fields, "processId", "data[processId]");
  const statusCode = pick(fields, "status", "statusCode", "data[statusCode]");
  const paid = statusCode === undefined || statusCode === "1" || statusCode === "2";

  const checkout = processId ? await deps.findCheckout(processId) : null;
  if (!checkout || !paid) {
    // Not a checkout of ours (or not a payment): log for a manual look only
    await deps.record({
      transactionId,
      userId: checkout?.userId ?? null,
      plan: checkout?.plan ?? null,
      amount: null,
      status: "UNVERIFIED",
    });
    return { status: 200, body: { ok: true, held: true } };
  }

  if (checkout.status === "APPLIED") {
    await deps.record({ transactionId, userId: checkout.userId, plan: checkout.plan, amount: checkout.sum, status: "DUPLICATE" });
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  // Ask Grow, with what WE stored (process + amount), whether this happened
  const confirmed = await deps.approve({
    transactionId,
    transactionToken: pick(fields, "transactionToken", "data[transactionToken]"),
    processId: checkout.processId,
    processToken: checkout.processToken ?? undefined,
    sum: String(checkout.sum),
  });
  if (!confirmed) {
    // Stays PENDING — the genuine callback can still apply it
    await deps.record({ transactionId, userId: checkout.userId, plan: checkout.plan, amount: checkout.sum, status: "UNVERIFIED" });
    return { status: 200, body: { ok: true, held: true } };
  }

  if (!(await deps.markApplied(checkout.id, transactionId))) {
    // Another delivery of the same payment got there first
    await deps.record({ transactionId, userId: checkout.userId, plan: checkout.plan, amount: checkout.sum, status: "DUPLICATE" });
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  await deps.extend(checkout.userId, checkout.plan);
  await deps.record({ transactionId, userId: checkout.userId, plan: checkout.plan, amount: checkout.sum, status: "VERIFIED" });
  return { status: 200, body: { ok: true } };
}
