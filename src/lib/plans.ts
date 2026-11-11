// The plans as shown to therapists — the landing page (#plans), the public
// /pricing page and the in-app "מנוי ומסלולים" page (/subscription).
// "מסלול" is the tier (PLAN_TIERS: one sold today, two shown as future, display
// only — nothing is stored or gated by tier); "מנוי" is how the tier sold today
// is paid for (PLAN_OPTIONS, the stored MONTHLY/YEARLY, plus the free trial).
// Prices come only from PRICING (src/lib/subscription.ts); keep /terms
// section 5 in step with them.

import { PRICING, TRIAL_DAYS, type SubscriptionState } from "@/lib/subscription";
import { TRIAL_SCHEDULING_DAYS } from "@/lib/scheduling-window";

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

/** Months a year of the yearly plan saves over paying monthly (today: 12 − 250/25 = 2). */
export function monthsFree(): number {
  const yearOfMonthly = PRICING.monthlyIntro * 12;
  return Math.round((yearOfMonthly - PRICING.yearlyIntro) / PRICING.monthlyIntro);
}

/** "חודש" / "חודשיים" / "3 חודשים" — Hebrew has a dual for two. */
export function monthsInHebrew(n: number): string {
  if (n === 1) return "חודש";
  if (n === 2) return "חודשיים";
  return `${n} חודשים`;
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "MONTHLY",
    title: "מנוי חודשי",
    price: PRICING.monthlyIntro,
    regularPrice: PRICING.monthlyRegular,
    per: "לחודש",
    note: "משלמים בכל חודש. ללא התחייבות.",
    highlight: false,
  },
  {
    id: "YEARLY",
    title: "מנוי שנתי",
    price: PRICING.yearlyIntro,
    regularPrice: PRICING.yearlyRegular,
    per: "לשנה",
    note: `תשלום אחת לשנה. קבלת ${monthsInHebrew(monthsFree())} מתנה בהתחייבות מראש.`,
    highlight: true,
  },
];

/**
 * The free trial ("מנוי היכרות"), shown as the first card beside the paid
 * plans. It is not something you buy — every account starts in it on
 * registration — so it is not a PlanOption and has no purchase button.
 * The rules it states are the ones in PLAN_FACTS / /terms; don't add new ones.
 */
export const TRIAL_PLAN = {
  title: "מנוי היכרות",
  price: 0,
  per: `ל-${TRIAL_DAYS} יום`,
  subtitle: "ללא תשלום · בלי כרטיס אשראי",
  note: `כל המערכת פתוחה ל-${TRIAL_DAYS} יום, ופגישות נקבעות עד ${TRIAL_SCHEDULING_DAYS} יום קדימה. בסוף בוחרים מנוי חודשי או שנתי — אין חיוב אוטומטי, ובלי מנוי המידע נשאר זמין לצפייה.`,
} as const;

/** Days left, on the trial card of an account that is in its trial. */
export function trialDaysLeftText(daysLeft: number | null): string {
  const n = daysLeft ?? 0;
  return n <= 1 ? "נותר יום אחד" : `נותרו ${n} ימים`;
}

export function planById(id: string | null | undefined): PlanOption | undefined {
  return PLAN_OPTIONS.find((p) => p.id === id);
}

export function planLabel(id: string | null | undefined): string {
  return planById(id)?.title ?? "מנוי";
}

/**
 * What the plan sold today ("ניהול קליניקה") includes: only what a user really
 * sees now. Issuing income documents and keeping expense documents are not in
 * it (they are hidden behind DOCUMENTS_ENABLED, src/lib/features.ts) — those
 * are the two future plans below.
 */
export const PLAN_FEATURES: string[] = [
  "יומן פגישות עם פגישות קבועות (כל שבוע / כל שבועיים) ומועדי ישראל",
  "תיק לכל לקוח/ה: פרטים, היסטוריית פגישות ומסמכים (PDF, Word ותמונות)",
  "סיכומי פגישות מוצפנים, עם יומן גישה לרשומות",
  "מעקב תשלומים לכל פגישה, ורישום מספרי חשבוניות וקבלות שהופקו מחוץ למערכת",
  "רשימת המתנה, משימות ותזכורות בוואטסאפ בלחיצה",
  "דוחות הכנסות וייצוא ל-PDF",
  "התקנה כאפליקציה בטלפון, כניסה עם Face ID ואימות דו-שלבי",
];

/** The name of the plan every account is on today; monthly / yearly are how it is paid. */
export const CLINIC_PLAN_NAME = "ניהול קליניקה";

export type PlanTierId = "CLINIC" | "CLINIC_INCOME" | "CLINIC_INCOME_EXPENSES";

/**
 * The plans ("מסלולים") as shown on the home page, /pricing, /register and
 * /subscription. Display only: nothing is stored per account and nothing is
 * gated by it. Only the first can be bought (through PLAN_OPTIONS); the future
 * ones have no price yet and no button — never type a price for them here.
 */
export type PlanTier = {
  id: PlanTierId;
  title: string;
  /** announced, not sold: badge instead of prices, no button */
  future: boolean;
  /** the ✓ list */
  features: string[];
};

export const AVAILABLE_PLAN_BADGE = "זמין היום";
export const FUTURE_PLAN_BADGE = "מסלול עתידי";
/** In the price slot of a future plan */
export const FUTURE_PLAN_PRICE_NOTE = "המחיר יפורסם עם השקת המסלול";

export const PLAN_TIERS: PlanTier[] = [
  { id: "CLINIC", title: CLINIC_PLAN_NAME, future: false, features: PLAN_FEATURES },
  {
    id: "CLINIC_INCOME",
    title: `${CLINIC_PLAN_NAME} כולל מסמכי הכנסות`,
    future: true,
    features: [
      `יכלול את כל מה שבמסלול ״${CLINIC_PLAN_NAME}״`,
      "יכלול הפקת מסמכי הכנסות: חשבונית מס, חשבונית מס/קבלה, קבלה וחשבונית זיכוי",
    ],
  },
  {
    id: "CLINIC_INCOME_EXPENSES",
    title: `${CLINIC_PLAN_NAME} כולל מסמכי הכנסות והוצאות`,
    future: true,
    features: [
      `יכלול את כל מה שבמסלול ״${CLINIC_PLAN_NAME} כולל מסמכי הכנסות״`,
      "יכלול מסמכי הוצאות: שמירת החשבוניות והקבלות של הוצאות הקליניקה, עם הפרטים והסכומים",
    ],
  },
];

/** The short rules shown under the plans (match /terms sections 4–7). */
export const PLAN_FACTS: string[] = [
  `${TRIAL_DAYS} יום ניסיון חינם מההרשמה — בלי כרטיס אשראי.`,
  `בתקופת הניסיון אפשר לקבוע פגישות עד ${TRIAL_SCHEDULING_DAYS} יום קדימה; במנוי חודשי או שנתי — בלי הגבלה.`,
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
      return `${CLINIC_PLAN_NAME} — ${planLabel(state.plan)} פעיל.`;
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
      `אשמח לרכוש ${plan.title} במסלול ״${CLINIC_PLAN_NAME}״ — ₪${plan.price} ${plan.per}.`,
      `מצב החשבון כרגע: ${status}.`,
      "נשלח מעמוד ״מנוי ומסלולים״.",
    ].join("\n"),
  };
}
