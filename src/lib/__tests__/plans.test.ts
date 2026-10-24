import { describe, expect, it } from "vitest";
import { PRICING, TRIAL_DAYS } from "@/lib/subscription";
import {
  PLAN_OPTIONS,
  TRIAL_PLAN,
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
    // 12 × 25 = 300 vs 250 → two months
    expect(planById("YEARLY")!.note).toContain("2 חודשים מתנה");
  });

  it("labels plans", () => {
    expect(planLabel("YEARLY")).toBe("מנוי שנתי");
    expect(planLabel(null)).toBe("מנוי");
    expect(planById("WEEKLY")).toBeUndefined();
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
    ).toBe("מנוי חודשי פעיל.");
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
    expect(r.message).toContain(`₪${PRICING.yearlyIntro} לשנה (כולל מע״מ)`);
    expect(r.message).toContain("בתקופת ניסיון (עד 19.10.26)");
    expect(r.message).not.toMatch(/undefined|null/);
  });
});
