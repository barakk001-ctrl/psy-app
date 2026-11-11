import { describe, expect, it } from "vitest";
import { PRICING, TRIAL_DAYS } from "@/lib/subscription";
import {
  PLAN_FACTS,
  PLAN_FEATURES,
  PLAN_OPTIONS,
  PLAN_TIERS,
  CLINIC_PLAN_NAME,
  FUTURE_PLAN_BADGE,
  FUTURE_PLAN_PRICE_NOTE,
  TRIAL_PLAN,
  monthsFree,
  monthsInHebrew,
  trialDaysLeftText,
  planById,
  planLabel,
  planRequestMessage,
  subscriptionHeadline,
} from "@/lib/plans";

describe("plan options", () => {
  it("take their prices from PRICING only", () => {
    expect(planById("MONTHLY")).toMatchObject({
      price: PRICING.monthlyIntro,
      regularPrice: PRICING.monthlyRegular,
    });
    expect(planById("YEARLY")).toMatchObject({
      price: PRICING.yearlyIntro,
      regularPrice: PRICING.yearlyRegular,
    });
    expect(PLAN_OPTIONS.map((p) => p.id)).toEqual(["MONTHLY", "YEARLY"]);
  });

  it("states the yearly saving in whole months", () => {
    // 12 × 25 = 300 vs 250 → two months, in the dual form
    expect(monthsFree()).toBe(2);
    expect(PRICING.yearlyIntro).toBe(PRICING.monthlyIntro * 10);
    expect(PRICING.yearlyRegular).toBe(PRICING.monthlyRegular * 10);
    expect(planById("YEARLY")!.note).toBe("תשלום אחת לשנה. קבלת חודשיים מתנה בהתחייבות מראש.");
  });

  it("describes the monthly plan", () => {
    expect(planById("MONTHLY")!.note).toBe("משלמים בכל חודש. ללא התחייבות.");
  });

  it("names no third-party invoicing system and no server location", () => {
    for (const f of PLAN_FEATURES) expect(f).not.toMatch(/morning|מורנינג|אירופה/i);
    expect(PLAN_FEATURES).toContain(
      "מעקב תשלומים לכל פגישה, ורישום מספרי חשבוניות וקבלות שהופקו מחוץ למערכת",
    );
  });

  it("words a number of months", () => {
    expect(monthsInHebrew(1)).toBe("חודש");
    expect(monthsInHebrew(2)).toBe("חודשיים");
    expect(monthsInHebrew(3)).toBe("3 חודשים");
  });

  it("labels plans", () => {
    expect(planLabel("YEARLY")).toBe("מנוי שנתי");
    expect(planLabel(null)).toBe("מנוי");
    expect(planById("WEEKLY")).toBeUndefined();
  });
});

describe("plan tiers", () => {
  it("lists the plan sold today first, then the two future ones", () => {
    expect(PLAN_TIERS.map((t) => t.title)).toEqual([
      "ניהול קליניקה",
      "ניהול קליניקה כולל מסמכי הכנסות",
      "ניהול קליניקה כולל מסמכי הכנסות והוצאות",
    ]);
    expect(PLAN_TIERS.map((t) => t.future)).toEqual([false, true, true]);
    expect(PLAN_TIERS[0].title).toBe(CLINIC_PLAN_NAME);
    expect(PLAN_TIERS[0].features).toBe(PLAN_FEATURES);
    expect(FUTURE_PLAN_BADGE).toBe("מסלול עתידי");
  });

  it("does not say the plan sold today issues or keeps tax documents", () => {
    const text = PLAN_FEATURES.join(" ");
    expect(text).not.toMatch(/הפקת|מפיק|מסמכי הכנס|מסמכי הוצא|חשבונית זיכוי/);
    // The one mention of invoices and receipts is of numbers issued elsewhere
    expect(PLAN_FEATURES.filter((f) => /חשבוני|קבל/.test(f))).toEqual([
      "מעקב תשלומים לכל פגישה, ורישום מספרי חשבוניות וקבלות שהופקו מחוץ למערכת",
    ]);
  });

  it("words the future plans as future, each building on the one before", () => {
    const [clinic, income, both] = PLAN_TIERS;
    for (const t of [income, both]) {
      expect(t.features.length).toBeGreaterThan(0);
      for (const f of t.features) expect(f.startsWith("יכלול")).toBe(true);
    }
    expect(income.features[0]).toContain(`״${clinic.title}״`);
    expect(income.features.join(" ")).toContain(
      "חשבונית מס, חשבונית מס/קבלה, קבלה וחשבונית זיכוי",
    );
    expect(both.features[0]).toContain(`״${income.title}״`);
    expect(both.features.join(" ")).toContain("מסמכי הוצאות");
  });

  it("shows no price for a future plan", () => {
    expect(FUTURE_PLAN_PRICE_NOTE).toBe("המחיר יפורסם עם השקת המסלול");
    const text = [FUTURE_PLAN_PRICE_NOTE, ...PLAN_TIERS.filter((t) => t.future).flatMap((t) => [t.title, ...t.features])].join(" ");
    expect(text).not.toMatch(/₪|[0-9]/);
    expect(text).not.toMatch(/morning|מורנינג/i);
  });
});

describe("public price wording", () => {
  it("says nothing about VAT or the operator's tax status", () => {
    const text = [...PLAN_FACTS, ...PLAN_OPTIONS.map((p) => p.note), TRIAL_PLAN.note].join(" ");
    expect(text).not.toContain("מע״מ");
    expect(text).not.toContain("עוסק פטור");
  });
});

describe("trial card", () => {
  it("is free for TRIAL_DAYS and is not a purchasable plan", () => {
    expect(TRIAL_PLAN.price).toBe(0);
    expect(TRIAL_PLAN.per).toBe(`ל-${TRIAL_DAYS} יום`);
    expect(TRIAL_PLAN.note).toContain(`${TRIAL_DAYS} יום`);
    expect(TRIAL_PLAN.note).toContain("אין חיוב אוטומטי");
    expect(planById("TRIAL")).toBeUndefined();
  });

  it("words the days left", () => {
    expect(trialDaysLeftText(12)).toBe("נותרו 12 ימים");
    expect(trialDaysLeftText(1)).toBe("נותר יום אחד");
    expect(trialDaysLeftText(null)).toBe("נותר יום אחד");
  });
});

describe("subscriptionHeadline", () => {
  const base = { activeUntil: null, plan: null, writable: true };
  it("words each status", () => {
    expect(subscriptionHeadline({ ...base, status: "exempt", daysLeft: null })).toContain("פטור");
    expect(subscriptionHeadline({ ...base, status: "trial", daysLeft: 12 })).toBe(
      "נותרו 12 ימים לתקופת הניסיון.",
    );
    expect(subscriptionHeadline({ ...base, status: "trial", daysLeft: 1 })).toContain("מחר");
    expect(
      subscriptionHeadline({ ...base, status: "active", plan: "MONTHLY", daysLeft: 20 }),
    ).toBe("ניהול קליניקה — מנוי חודשי פעיל.");
    expect(
      subscriptionHeadline({ ...base, status: "expired", daysLeft: 0, writable: false }),
    ).toContain("קריאה בלבד");
  });
});

describe("planRequestMessage", () => {
  it("names the plan, its price and the account's state", () => {
    const r = planRequestMessage(
      planById("YEARLY")!,
      { status: "trial", activeUntil: new Date(), plan: null, daysLeft: 5, writable: true },
      "19.10.26",
    );
    expect(r.subject).toBe("בקשה לרכישת מנוי שנתי");
    expect(r.message).toContain(`₪${PRICING.yearlyIntro} לשנה.`);
    expect(r.message).toContain("מנוי שנתי במסלול ״ניהול קליניקה״");
    expect(r.message).not.toContain("מע״מ");
    expect(r.message).not.toContain("עוסק פטור");
    expect(r.message).not.toContain("כולל מע״מ");
    expect(r.message).toContain("בתקופת ניסיון (עד 19.10.26)");
    expect(r.message).not.toMatch(/undefined|null/);
  });
});
