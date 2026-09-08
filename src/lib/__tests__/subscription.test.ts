import { describe, expect, it } from "vitest";
import { getSubscriptionState, type SubscriptionFields } from "@/lib/subscription";

const NOW = new Date("2026-09-09T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const user = (over: Partial<SubscriptionFields> = {}): SubscriptionFields => ({
  createdAt: days(-10),
  trialEndsAt: days(20),
  subscriptionPlan: null,
  subscriptionEndsAt: null,
  subscriptionExempt: false,
  isAdmin: false,
  ...over,
});

describe("getSubscriptionState", () => {
  it("exempt and admin accounts are always writable", () => {
    expect(getSubscriptionState(user({ subscriptionExempt: true, trialEndsAt: days(-5) }), NOW).status).toBe("exempt");
    expect(getSubscriptionState(user({ isAdmin: true, trialEndsAt: days(-5) }), NOW).writable).toBe(true);
  });

  it("active paid subscription wins over an expired trial", () => {
    const s = getSubscriptionState(
      user({ trialEndsAt: days(-1), subscriptionPlan: "MONTHLY", subscriptionEndsAt: days(15) }),
      NOW,
    );
    expect(s.status).toBe("active");
    expect(s.daysLeft).toBe(15);
    expect(s.writable).toBe(true);
  });

  it("in-trial accounts are writable with a countdown", () => {
    const s = getSubscriptionState(user(), NOW);
    expect(s.status).toBe("trial");
    expect(s.daysLeft).toBe(20);
    expect(s.writable).toBe(true);
  });

  it("expired trial with no subscription is read-only", () => {
    const s = getSubscriptionState(user({ trialEndsAt: days(-1) }), NOW);
    expect(s.status).toBe("expired");
    expect(s.writable).toBe(false);
  });

  it("falls back to createdAt + 30 days when trialEndsAt is missing", () => {
    const inTrial = getSubscriptionState(user({ trialEndsAt: null, createdAt: days(-10) }), NOW);
    expect(inTrial.status).toBe("trial");
    const expired = getSubscriptionState(user({ trialEndsAt: null, createdAt: days(-40) }), NOW);
    expect(expired.status).toBe("expired");
  });
});
