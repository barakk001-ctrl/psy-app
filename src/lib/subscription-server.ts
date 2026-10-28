import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schedulingWindow, windowUi, type WindowUi } from "@/lib/scheduling-window";
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

/** The trial's scheduling limit for the date pickers, or null (no limit). */
export async function schedulingWindowUiFor(userId: string): Promise<WindowUi | null> {
  return windowUi(schedulingWindow(await subscriptionStateFor(userId)));
}

/** Where a blocked void action (a plain <form action>, a button) sends the user:
 *  "מנוי ומסלולים" with the read-only notice (READ_ONLY_ERROR) on top. */
export const READ_ONLY_PATH = "/subscription?readonly=1";

/**
 * The one write lock for expired accounts (read-only, never locked out).
 * Every mutating server action calls it right after resolving the user —
 * enforced by write-lock.test.ts, which fails for any exported action that is
 * neither gated nor on its allowlist (sign-in, security, export, purchase
 * request, support…). Active trial/paid accounts and exempt accounts are
 * always writable, so for them this is one cheap lookup and nothing else.
 *
 * - `isReadOnly(userId)` → for actions that return a state with `error`:
 *     `if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };`
 * - `requireWritable(userId)` → for actions with nothing to return: redirects
 *     to READ_ONLY_PATH, where the same message is shown.
 */
export async function isReadOnly(userId: string): Promise<boolean> {
  return subscriptionReadOnly(userId);
}

export async function requireWritable(userId: string): Promise<void> {
  if (await subscriptionReadOnly(userId)) redirect(READ_ONLY_PATH);
}
