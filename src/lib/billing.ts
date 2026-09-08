// Grow (Meshulam) card payments. Configured entirely by env vars — until
// they are set, the app silently stays on the manual-payment flow:
//   GROW_USER_ID    business identifier from Grow
//   GROW_PAGE_CODE  payment-page identifier from Grow
//   GROW_BASE_URL   optional; https://sandbox.meshulam.co.il for testing
//                   (default https://secure.meshulam.co.il)
// Docs: https://developers.grow.business — createPaymentProcess + callback.

import { PRICING } from "@/lib/subscription";

const BASE = () => process.env.GROW_BASE_URL || "https://secure.meshulam.co.il";

export function billingConfigured(): boolean {
  return !!(process.env.GROW_USER_ID && process.env.GROW_PAGE_CODE);
}

export function planAmount(plan: "MONTHLY" | "YEARLY"): number {
  return plan === "YEARLY" ? PRICING.yearlyIntro : PRICING.monthlyIntro;
}

type CreateLinkArgs = {
  userId: string;
  plan: "MONTHLY" | "YEARLY";
  fullName: string;
  email: string;
  phone: string | null;
  origin: string;
};

/** Creates a hosted payment page for one subscription period. Returns the
 *  redirect URL, or an error string (Hebrew) for the UI. */
export async function createGrowPaymentLink(
  args: CreateLinkArgs,
): Promise<{ url: string } | { error: string }> {
  if (!billingConfigured()) {
    return { error: "תשלום בכרטיס עדיין לא הופעל — פנו למנהלת המערכת" };
  }

  const sum = planAmount(args.plan);
  const label = args.plan === "YEARLY" ? "מנוי שנתי" : "מנוי חודשי";
  // Grow requires a two-word customer name
  const fullName = args.fullName.trim().includes(" ")
    ? args.fullName.trim()
    : `${args.fullName.trim()} .`;

  const body = new URLSearchParams();
  body.set("userId", process.env.GROW_USER_ID!);
  body.set("pageCode", process.env.GROW_PAGE_CODE!);
  body.set("sum", String(sum));
  body.set("description", `${label} — מרפאה אישית`);
  body.set("chargeType", "1");
  body.set("paymentNum", "1");
  body.set("successUrl", `${args.origin}/settings?paid=1`);
  body.set("cancelUrl", `${args.origin}/settings?paid=0`);
  body.set("notifyUrl", `${args.origin}/api/billing/webhook`);
  body.set("pageField[fullName]", fullName);
  if (args.phone) body.set("pageField[phone]", args.phone.replace(/\D/g, ""));
  body.set("pageField[email]", args.email);
  body.set("cField1", args.userId);
  body.set("cField2", args.plan);

  try {
    const res = await fetch(`${BASE()}/api/light/server/1.0/createPaymentProcess`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as {
      status?: number | string;
      data?: { url?: string; processId?: string | number; processToken?: string };
      err?: { message?: string };
    };
    const url = json?.data?.url;
    if (!url) {
      console.error("Grow createPaymentProcess failed:", JSON.stringify(json).slice(0, 500));
      return { error: "יצירת דף התשלום נכשלה — נסו שוב או פנו למנהלת המערכת" };
    }
    return { url };
  } catch (err) {
    console.error("Grow createPaymentProcess error:", err);
    return { error: "שירות התשלומים לא זמין כרגע — נסו שוב מאוחר יותר" };
  }
}

/** Best-effort server-side confirmation of a callback against Grow's API.
 *  Returns true only when Grow acknowledges the transaction under OUR
 *  credentials — a forged webhook can't pass this. */
export async function approveGrowTransaction(fields: {
  transactionId?: string;
  transactionToken?: string;
  processId?: string;
  processToken?: string;
  sum?: string;
}): Promise<boolean> {
  if (!billingConfigured()) return false;
  const body = new URLSearchParams();
  body.set("userId", process.env.GROW_USER_ID!);
  body.set("pageCode", process.env.GROW_PAGE_CODE!);
  if (fields.transactionId) body.set("transactionId", fields.transactionId);
  if (fields.transactionToken) body.set("transactionToken", fields.transactionToken);
  if (fields.processId) body.set("processId", fields.processId);
  if (fields.processToken) body.set("processToken", fields.processToken);
  if (fields.sum) body.set("sum", fields.sum);

  try {
    const res = await fetch(`${BASE()}/api/light/server/1.0/approveTransaction`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as { status?: number | string };
    return String(json?.status) === "1";
  } catch (err) {
    console.error("Grow approveTransaction error:", err);
    return false;
  }
}
