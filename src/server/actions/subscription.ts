"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extendSubscription } from "@/lib/subscription-server";
import { createGrowPaymentLink } from "@/lib/billing";

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

  const h = await headers();
  const origin =
    process.env.NEXTAUTH_URL ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const result = await createGrowPaymentLink({
    userId: session.user.id,
    plan,
    fullName: me.name,
    email: me.email,
    phone: me.phone,
    origin,
  });
  if ("url" in result) redirect(result.url);
  redirect(`/settings?payerr=${encodeURIComponent(result.error)}`);
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
