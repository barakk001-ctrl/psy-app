import { describe, expect, it } from "vitest";
import { handleGrowCallback, type GrowCallbackDeps, type StoredCheckout } from "@/lib/grow-callback";

// A fake Grow + DB: one stored checkout; approve() says whether Grow confirms.
function harness(checkout: StoredCheckout | null, growConfirms: (a: { transactionId: string }) => boolean) {
  const state = { checkout: checkout ? { ...checkout } : null };
  const calls = { approve: [] as unknown[], extend: [] as [string, string][], events: [] as { status: string; userId: string | null }[] };
  const deps: GrowCallbackDeps = {
    findCheckout: async (pid) => (state.checkout && state.checkout.processId === pid ? { ...state.checkout } : null),
    approve: async (a) => {
      calls.approve.push(a);
      return growConfirms(a);
    },
    markApplied: async (id) => {
      if (!state.checkout || state.checkout.id !== id || state.checkout.status !== "PENDING") return false;
      state.checkout.status = "APPLIED";
      return true;
    },
    extend: async (u, p) => calls.extend.push([u, p]),
    record: async (e) => calls.events.push({ status: e.status, userId: e.userId }),
  };
  return { deps, calls, state };
}

const stored: StoredCheckout = {
  id: "co1",
  userId: "user-a",
  plan: "MONTHLY",
  sum: 25,
  processId: "proc-1",
  processToken: "ptok",
  status: "PENDING",
};
const realTx = "tx-real";

describe("Grow callback", () => {
  it("a forged early callback can't block the real one", async () => {
    const h = harness(stored, (a) => a.transactionId === realTx);
    const forged = await handleGrowCallback({ transactionId: "tx-fake", processId: "proc-1" }, h.deps);
    expect(forged.body).toEqual({ ok: true, held: true });
    expect(h.state.checkout!.status).toBe("PENDING");
    const real = await handleGrowCallback({ transactionId: realTx, processId: "proc-1", transactionToken: "t" }, h.deps);
    expect(real.body).toEqual({ ok: true });
    expect(h.calls.extend).toEqual([["user-a", "MONTHLY"]]);
  });

  it("user, plan and amount come from the stored checkout, not the payload", async () => {
    const h = harness(stored, () => true);
    await handleGrowCallback(
      { transactionId: realTx, processId: "proc-1", cField1: "user-attacker", cField2: "YEARLY", sum: "1" },
      h.deps,
    );
    expect(h.calls.extend).toEqual([["user-a", "MONTHLY"]]);
    expect(h.calls.approve[0]).toMatchObject({ processId: "proc-1", processToken: "ptok", sum: "25", transactionId: realTx });
  });

  it("a callback for a checkout we never created is only logged — Grow isn't even asked", async () => {
    const h = harness(stored, () => true);
    const r = await handleGrowCallback({ transactionId: realTx, processId: "proc-unknown", cField1: "user-a" }, h.deps);
    expect(r.body).toEqual({ ok: true, held: true });
    expect(h.calls.approve).toEqual([]);
    expect(h.calls.extend).toEqual([]);
    expect(h.calls.events[0].status).toBe("UNVERIFIED");
  });

  it("Grow not confirming leaves it pending and extends nothing", async () => {
    const h = harness(stored, () => false);
    const r = await handleGrowCallback({ transactionId: realTx, processId: "proc-1" }, h.deps);
    expect(r.body).toEqual({ ok: true, held: true });
    expect(h.calls.extend).toEqual([]);
    expect(h.state.checkout!.status).toBe("PENDING");
  });

  it("a re-delivered callback extends only once", async () => {
    const h = harness(stored, () => true);
    await handleGrowCallback({ transactionId: realTx, processId: "proc-1" }, h.deps);
    const again = await handleGrowCallback({ transactionId: realTx, processId: "proc-1" }, h.deps);
    expect(again.body).toEqual({ ok: true, duplicate: true });
    expect(h.calls.extend).toHaveLength(1);
  });

  it("a failed payment status is not applied; no transaction id is a 400", async () => {
    const h = harness(stored, () => true);
    expect((await handleGrowCallback({ transactionId: realTx, processId: "proc-1", statusCode: "0" }, h.deps)).body).toEqual({ ok: true, held: true });
    expect(h.calls.extend).toEqual([]);
    expect((await handleGrowCallback({ processId: "proc-1" }, h.deps)).status).toBe(400);
  });
});
