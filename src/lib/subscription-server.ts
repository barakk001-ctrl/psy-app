import { db } from "@/lib/db";
import {
  SUBSCRIPTION_FIELD_SELECT,
  getSubscriptionState,
  type SubscriptionState,
} from "@/lib/subscription";

/** Loads the user's subscription state (server-side only). */
export async function subscriptionStateFor(userId: string): Promise<SubscriptionState> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: SUBSCRIPTION_FIELD_SELECT,
  });
  // Unknown user: let the caller's own auth checks surface the real error
  if (!u) return { status: "expired", activeUntil: null, plan: null, daysLeft: 0, writable: false };
  return getSubscriptionState(u);
}

/** True when the account is past its trial/subscription — writes must refuse. */
export async function subscriptionReadOnly(userId: string): Promise<boolean> {
  return !(await subscriptionStateFor(userId)).writable;
}

/** Extends a subscription by one period from max(now, current end). Shared by
 *  the admin card and the payment webhook. */
export async function extendSubscription(
  userId: string,
  plan: "MONTHLY" | "YEARLY",
): Promise<Date | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionEndsAt: true },
  });
  if (!u) return null;

  const now = new Date();
  const base = u.subscriptionEndsAt && u.subscriptionEndsAt > now ? u.subscriptionEndsAt : now;
  const next = new Date(base);
  if (plan === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);

  await db.user.update({
    where: { id: userId },
    data: { subscriptionPlan: plan, subscriptionEndsAt: next },
  });
  return next;
}
