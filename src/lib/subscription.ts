// Subscription state and pricing. Payments happen outside the app (Bit/bank
// transfer + a morning receipt); the operator extends accounts from the
// admin card in Settings. Expired accounts are read-only, never locked out.

export const PRICING = {
  monthlyRegular: 45,
  monthlyIntro: 25, // מחיר היכרות
  yearlyRegular: 450,
  yearlyIntro: 250, // מחיר היכרות
} as const;

export const TRIAL_DAYS = 30;

export type SubscriptionFields = {
  createdAt: Date;
  trialEndsAt: Date | null;
  subscriptionPlan: string | null;
  subscriptionEndsAt: Date | null;
  subscriptionExempt: boolean;
  isAdmin: boolean;
};

export type SubscriptionState = {
  status: "exempt" | "trial" | "active" | "expired";
  /** end of the current trial/paid window (null for exempt) */
  activeUntil: Date | null;
  plan: string | null;
  daysLeft: number | null;
  writable: boolean;
};

export function getSubscriptionState(
  u: SubscriptionFields,
  now: Date = new Date(),
): SubscriptionState {
  if (u.subscriptionExempt || u.isAdmin) {
    return { status: "exempt", activeUntil: null, plan: null, daysLeft: null, writable: true };
  }

  const paidUntil = u.subscriptionEndsAt;
  if (paidUntil && paidUntil > now) {
    return {
      status: "active",
      activeUntil: paidUntil,
      plan: u.subscriptionPlan,
      daysLeft: daysBetween(now, paidUntil),
      writable: true,
    };
  }

  // Pre-feature accounts without a stamped trial fall back to createdAt + 30d
  const trialEnd =
    u.trialEndsAt ?? new Date(u.createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  if (trialEnd > now) {
    return {
      status: "trial",
      activeUntil: trialEnd,
      plan: null,
      daysLeft: daysBetween(now, trialEnd),
      writable: true,
    };
  }

  return { status: "expired", activeUntil: paidUntil ?? trialEnd, plan: u.subscriptionPlan, daysLeft: 0, writable: false };
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

export const SUBSCRIPTION_FIELD_SELECT = {
  createdAt: true,
  trialEndsAt: true,
  subscriptionPlan: true,
  subscriptionEndsAt: true,
  subscriptionExempt: true,
  isAdmin: true,
} as const;

/** Hebrew error returned by write actions when the account is read-only. */
export const READ_ONLY_ERROR =
  "המנוי הסתיים והמערכת במצב קריאה בלבד — הנתונים שמורים וזמינים לצפייה. לחידוש פנו למנהלת המערכת.";
