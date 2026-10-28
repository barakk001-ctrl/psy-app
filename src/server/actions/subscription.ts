"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extendSubscription } from "@/lib/subscription-server";
import { originFromHeaders } from "@/lib/request-origin";
import { createGrowPaymentLink } from "@/lib/billing";
import { subscriptionStateFor } from "@/lib/subscription-server";
import { planById, planRequestMessage } from "@/lib/plans";
import { formatDate } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { submitSupportRequest } from "@/lib/support-request";
import { emailSupportRequest, recordSupportEmail } from "@/lib/support-data";

/** Admin-only: the operator accounts manage everyone's subscription. */
async function requireAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) throw new Error("Forbidden");
  return session.user.id;
}

/** Extends a user's subscription by a month/year from max(now, current end). */
export async function extendSubscriptionAction(formData: FormData) {
  await requireAdminId();
  const userId = String(formData.get("userId") ?? "");
  const plan = formData.get("plan") === "YEARLY" ? "YEARLY" : "MONTHLY";
  if (!userId) return;
  await extendSubscription(userId, plan);
  revalidatePath("/settings");
}

/** Starts a card payment for the signed-in user's own subscription. */
export async function startCardPaymentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const plan = formData.get("plan") === "YEARLY" ? "YEARLY" : "MONTHLY";

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });
  if (!me) return;

  // Back to the address the payment started from.
  const origin = originFromHeaders(await headers()) ?? "";

  const result = await createGrowPaymentLink({
    userId: session.user.id,
    plan,
    fullName: me.name,
    email: me.email,
    phone: me.phone,
    origin,
  });
  if ("url" in result) {
    // The callback is believed only for a checkout stored here (grow-callback.ts)
    await db.growCheckout.create({
      data: {
        userId: session.user.id,
        plan,
        sum: result.sum,
        processId: result.processId,
        processToken: result.processToken,
      },
    });
    redirect(result.url);
  }
  redirect(`/subscription?payerr=${encodeURIComponent(result.error)}`);
}

export type PlanRequestResult = { ok: true; emailed: boolean } | { ok: false; error: string };

/**
 * "בקשה לרכישה" on /subscription while card payment (Grow) is off: sends the
 * operator a support request naming the plan — saved first, then emailed,
 * like every support request (Settings → פניות תמיכה shows it either way).
 * The operator replies with payment details and extends the account.
 */
export async function requestPlanAction(planId: string): Promise<PlanRequestResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const plan = planById(planId);
  if (!plan) return { ok: false, error: "המסלול לא נמצא" };

  const limit = rateLimit(`plan-request:${userId}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { ok: false, error: "הבקשה כבר נשלחה — נחזור אלייך בהקדם." };
  }

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!me) return { ok: false, error: "החשבון לא נמצא" };
  const state = await subscriptionStateFor(userId);
  const { subject, message } = planRequestMessage(
    plan,
    state,
    state.activeUntil ? formatDate(state.activeUntil) : null,
  );

  try {
    const result = await submitSupportRequest({
      save: () =>
        db.supportRequest.create({
          data: {
            userId,
            name: me.name,
            email: me.email.toLowerCase(),
            phone: me.phone || null,
            subject,
            message,
            pagePath: "/subscription",
          },
          select: { id: true },
        }),
      send: emailSupportRequest,
      recordEmail: recordSupportEmail,
    });
    revalidatePath("/settings");
    return { ok: true, emailed: result.emailed };
  } catch (err) {
    console.error("Plan request could not be saved:", err);
    return { ok: false, error: "לא הצלחנו לשלוח את הבקשה. נא לנסות שוב בעוד רגע." };
  }
}

export async function toggleSubscriptionExemptAction(formData: FormData) {
  const adminId = await requireAdminId();
  const userId = String(formData.get("userId") ?? "");
  // Admins can't un-exempt themselves by accident
  if (!userId || userId === adminId) return;
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionExempt: true },
  });
  if (!u) return;
  await db.user.update({
    where: { id: userId },
    data: { subscriptionExempt: !u.subscriptionExempt },
  });
  revalidatePath("/settings");
}
