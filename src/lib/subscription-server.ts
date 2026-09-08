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
