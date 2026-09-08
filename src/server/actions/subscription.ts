"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  const u = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionEndsAt: true },
  });
  if (!u) return;

  const now = new Date();
  const base =
    u.subscriptionEndsAt && u.subscriptionEndsAt > now ? u.subscriptionEndsAt : now;
  const next = new Date(base);
  if (plan === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);

  await db.user.update({
    where: { id: userId },
    data: { subscriptionPlan: plan, subscriptionEndsAt: next },
  });
  revalidatePath("/settings");
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
