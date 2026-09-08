import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approveGrowTransaction, billingConfigured, planAmount } from "@/lib/billing";
import { extendSubscription } from "@/lib/subscription-server";

// Grow server-to-server callback. Trust model: the payload alone proves
// nothing (no signature) — we confirm the transaction against Grow's API
// under our own credentials before extending anything. Unverifiable events
// are stored for the admin to inspect, never auto-applied.
export async function POST(req: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 404 });
  }

  // Grow may send form-encoded or JSON
  let fields: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      fields = flatten(j);
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) fields[k] = String(v);
    }
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const pick = (...names: string[]) =>
    names.map((n) => fields[n]).find((v) => v !== undefined && v !== "");

  const transactionId =
    pick("transactionId", "data[transactionId]", "asmachta") ?? null;
  const userId = pick("cField1", "data[cField1]", "customFields[cField1]") ?? null;
  const planRaw = pick("cField2", "data[cField2]", "customFields[cField2]");
  const plan = planRaw === "YEARLY" ? "YEARLY" : planRaw === "MONTHLY" ? "MONTHLY" : null;
  const sum = pick("sum", "data[sum]");
  const statusCode = pick("status", "statusCode", "data[statusCode]");

  if (!transactionId) return NextResponse.json({ error: "no transaction" }, { status: 400 });

  // Idempotency — a re-delivered callback must not extend twice
  const seen = await db.billingEvent.findUnique({ where: { transactionId } });
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  const rawStr = JSON.stringify(fields).slice(0, 4000);

  const record = async (status: string, uid: string | null) =>
    db.billingEvent
      .create({
        data: {
          transactionId,
          userId: uid,
          plan,
          amount: sum ? parseFloat(sum) : null,
          status,
          raw: rawStr,
        },
      })
      .catch(() => null); // unique race: another delivery won — fine

  // Basic claims that must hold before we even call Grow
  const user = userId
    ? await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    : null;
  const amountOk =
    plan && sum ? parseFloat(sum) >= planAmount(plan) - 0.01 : false;
  const paid = statusCode === undefined || String(statusCode) === "1" || String(statusCode) === "2";

  if (!user || !plan || !amountOk || !paid) {
    await record("UNVERIFIED", user?.id ?? null);
    return NextResponse.json({ ok: true, held: true });
  }

  const confirmed = await approveGrowTransaction({
    transactionId,
    transactionToken: pick("transactionToken", "data[transactionToken]"),
    processId: pick("processId", "data[processId]"),
    processToken: pick("processToken", "data[processToken]"),
    sum,
  });

  if (!confirmed) {
    await record("UNVERIFIED", user.id);
    return NextResponse.json({ ok: true, held: true });
  }

  await extendSubscription(user.id, plan);
  await record("VERIFIED", user.id);
  return NextResponse.json({ ok: true });
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
