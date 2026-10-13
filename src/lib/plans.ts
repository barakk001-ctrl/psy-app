// The purchase plans as shown to therapists — the public /pricing page and
// the in-app "מנוי ומסלולים" page (/subscription). Prices come only from
// PRICING (src/lib/subscription.ts); keep /terms section 5 in step with them.

import { PRICING, TRIAL_DAYS, type SubscriptionState } from "@/lib/subscription";

export type PlanId = "MONTHLY" | "YEARLY";

export type PlanOption = {
  id: PlanId;
  title: string;
  /** price now (intro price) */
  price: number;
  /** regular price, shown struck through */
  regularPrice: number;
  /** "לחודש" / "לשנה" */
  per: string;
  /** small line under the price */
  note: string;
  highlight: boolean;
};

/** What a monthly year would cost at today's monthly price. */
function monthsFree(): number {
  const yearOfMonthly = PRICING.monthlyIntro * 12;
  return Math.round((yearOfMonthly - PRICING.yearlyIntro) / PRICING.monthlyIntro);
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "MONTHLY",
    title: "מנוי חודשי",
    price: PRICING.monthlyIntro,
    regularPrice: PRICING.monthlyRegular,
    per: "לחודש",
    note: "משלמים חודש בכל פעם. אפשר להפסיק מתי שרוצים.",
    highlight: false,
  },
  {
    id: "YEARLY",
    title: "מנוי שנתי",
    price: PRICING.yearlyIntro,
    regularPrice: PRICING.yearlyRegular,
    per: "לשנה",
    note: `תשלום אחד לשנה — ${monthsFree()} חודשים מתנה לעומת החודשי.`,
    highlight: true,
  },
];

export function planById(id: string | null | undefined): PlanOption | undefined {
  return PLAN_OPTIONS.find((p) => p.id === id);
}

export function planLabel(id: string | null | undefined): string {
  return planById(id)?.title ?? "מנוי";
}

/** Everything is in every plan — the plans differ only in how you pay. */
export const PLAN_FEATURES: string[] = [
  "יומן פגישות עם פגישות קבועות (כל שבוע / כל שבועיים) ומועדי ישראל",
  "תיק לכל מטופל/ת: פרטים, היסטוריית פגישות ומסמכים",
  "סיכומי פגישות מוצפנים, עם יומן גישה לרשומות",
  "מעקב תשלומים לכל פגישה וחיבור לחשבונית ירוקה (morning)",
  "רשימת המתנה, משימות ותזכורות בוואטסאפ בלחיצה",
  "דוחות הכנסות וייצוא ל-PDF",
  "התקנה כאפליקציה בטלפון, כניסה עם Face ID ואימות דו-שלבי",
  "המידע נשמר בשרתים באירופה ומגובה מדי יום",
];

/** The short rules shown under the plans (match /terms sections 4–7). */
export const PLAN_FACTS: string[] = [
  `${TRIAL_DAYS} יום ניסיון חינם מההרשמה — בלי כרטיס אשראי.`,
  "המנוי לא מתחדש אוטומטית: בסוף התקופה מחדשים רק אם רוצים.",
  "אם המנוי מסתיים לא נחסמים: כל המידע נשאר זמין לצפייה ולייצוא (מצב קריאה בלבד).",
  "מחיר ההיכרות נשמר לכל התקופה שנרכשה בו.",
];

/** Headline for the user's own status on /subscription. */
export function subscriptionHeadline(state: SubscriptionState): string {
  switch (state.status) {
    case "exempt":
      return "החשבון שלך פטור ממנוי — אין צורך לרכוש.";
    case "trial":
      return state.daysLeft === 1
        ? "תקופת הניסיון מסתיימת מחר."
        : `נותרו ${state.daysLeft ?? 0} ימים לתקופת הניסיון.`;
    case "active":
      return `${planLabel(state.plan)} פעיל.`;
    case "expired":
      return "המנוי הסתיים — המערכת במצב קריאה בלבד עד החידוש.";
  }
}

/** Subject + body of the "בקשה לרכישה" sent to the operator when card payment is off. */
export function planRequestMessage(
  plan: PlanOption,
  state: SubscriptionState,
  activeUntilText: string | null,
): { subject: string; message: string } {
  const status =
    state.status === "trial"
      ? `בתקופת ניסיון${activeUntilText ? ` (עד ${activeUntilText})` : ""}`
      : state.status === "active"
        ? `${planLabel(state.plan)} פעיל${activeUntilText ? ` עד ${activeUntilText}` : ""}`
        : state.status === "expired"
          ? "המנוי הסתיים"
          : "פטור ממנוי";
  return {
    subject: `בקשה לרכישת ${plan.title}`,
    message: [
      `אשמח לרכוש ${plan.title} — ₪${plan.price} ${plan.per}.`,
      `מצב החשבון כרגע: ${status}.`,
      "נשלח מעמוד ״מנוי ומסלולים״.",
    ].join("\n"),
  };
}
