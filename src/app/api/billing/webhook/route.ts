import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approveGrowTransaction, billingConfigured } from "@/lib/billing";
import { extendSubscription } from "@/lib/subscription-server";
import { handleGrowCallback, type GrowPlan, type StoredCheckout } from "@/lib/grow-callback";

// Grow server-to-server callback. The payload is unsigned, so it proves
// nothing: handleGrowCallback (src/lib/grow-callback.ts) matches it to the
// checkout we stored when the payment page was created, takes user/plan/sum
// from there, has Grow confirm the transaction under our credentials, and
// applies each checkout once. Unverifiable callbacks are only logged.
export async function POST(req: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 404 });
  }

  // Grow may send form-encoded or JSON
  let fields: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      fields = flatten((await req.json()) as Record<string, unknown>);
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) fields[k] = String(v);
    }
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  const raw = JSON.stringify(fields).slice(0, 4000);

  const result = await handleGrowCallback(fields, {
    findCheckout: async (processId) => {
      const c = await db.growCheckout.findUnique({ where: { processId } });
      return c ? ({ ...c, plan: c.plan as GrowPlan, status: c.status as StoredCheckout["status"] }) : null;
    },
    approve: (args) => approveGrowTransaction(args),
    markApplied: async (id, transactionId) => {
      const r = await db.growCheckout.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPLIED", transactionId, appliedAt: new Date() },
      });
      return r.count === 1;
    },
    extend: (userId, plan) => extendSubscription(userId, plan),
    record: (e) =>
      db.billingEvent.create({ data: { ...e, raw } }).catch((err) => {
        console.error("billing event not recorded:", err);
        return null;
      }),
  });
  return NextResponse.json(result.body, { status: result.status });
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}
