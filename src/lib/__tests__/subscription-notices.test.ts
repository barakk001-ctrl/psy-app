import { describe, expect, it } from "vitest";
import type { SendEmailParams, SendEmailResult } from "@/lib/email";
import { OPERATOR_EMAIL, OPERATOR_TRADE_NAME } from "@/lib/operator";
import { buildSubscriptionNoticeEmail } from "@/lib/subscription-notice-email";
import {
  ENDED_WINDOW_DAYS,
  MAX_PER_RUN,
  dueNotice,
  sendDueNotices,
  type DueNotice,
  type NoticeUser,
} from "@/lib/subscription-notices";

const NOW = new Date("2026-11-10T10:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(NOW.getTime() + ms);

function user(over: Partial<NoticeUser> = {}): NoticeUser {
  return {
    id: "u1",
    email: "therapist@example.com",
    name: "מטפלת לדוגמה",
    emailVerifiedAt: at(-40 * DAY),
    createdAt: at(-40 * DAY),
    trialEndsAt: at(20 * DAY),
    subscriptionPlan: null,
    subscriptionEndsAt: null,
    subscriptionExempt: false,
    isAdmin: false,
    ...over,
  };
}

describe("dueNotice", () => {
  it("nothing while the end is more than 7 days away", () => {
    expect(dueNotice(user({ trialEndsAt: at(7 * DAY + HOUR) }), NOW)).toBeNull();
  });

  it("the 7-day notice from 7 days down to a day", () => {
    const n = dueNotice(user({ trialEndsAt: at(7 * DAY) }), NOW);
    expect(n).toMatchObject({ stage: "DAYS_7", kind: "TRIAL", daysLeft: 7 });
    expect(dueNotice(user({ trialEndsAt: at(DAY + HOUR) }), NOW)?.stage).toBe("DAYS_7");
  });

  it("the 1-day notice in the last 24 hours", () => {
    expect(dueNotice(user({ trialEndsAt: at(DAY) }), NOW)?.stage).toBe("DAY_1");
    expect(dueNotice(user({ trialEndsAt: at(HOUR) }), NOW)?.stage).toBe("DAY_1");
  });

  it("a paying account is told about the subscription, not the trial", () => {
    const n = dueNotice(
      user({ trialEndsAt: at(-100 * DAY), subscriptionPlan: "MONTHLY", subscriptionEndsAt: at(3 * DAY) }),
      NOW,
    );
    expect(n).toMatchObject({ stage: "DAYS_7", kind: "SUBSCRIPTION", daysLeft: 3 });
  });

  it("the ended notice, only soon after the end", () => {
    expect(dueNotice(user({ trialEndsAt: at(-HOUR) }), NOW)).toMatchObject({ stage: "ENDED", kind: "TRIAL" });
    expect(dueNotice(user({ trialEndsAt: at(-ENDED_WINDOW_DAYS * DAY - HOUR) }), NOW)).toBeNull();
  });

  it("an ended account is described by whichever ended last", () => {
    const paid = user({ trialEndsAt: at(-40 * DAY), subscriptionEndsAt: at(-DAY), subscriptionPlan: "YEARLY" });
    expect(dueNotice(paid, NOW)).toMatchObject({ stage: "ENDED", kind: "SUBSCRIPTION", periodEnd: at(-DAY) });
    const old = user({ trialEndsAt: at(-DAY), subscriptionEndsAt: at(-90 * DAY) });
    expect(dueNotice(old, NOW)).toMatchObject({ kind: "TRIAL", periodEnd: at(-DAY) });
  });

  it("an account from before the trial field falls back to createdAt + 30 days", () => {
    const n = dueNotice(user({ trialEndsAt: null, createdAt: at(-25 * DAY) }), NOW);
    expect(n).toMatchObject({ stage: "DAYS_7", kind: "TRIAL" });
  });

  it("never for exempt or admin accounts, whatever their dates say", () => {
    for (const over of [{ subscriptionExempt: true }, { isAdmin: true }]) {
      expect(dueNotice(user({ ...over, trialEndsAt: at(2 * DAY) }), NOW)).toBeNull();
      expect(dueNotice(user({ ...over, trialEndsAt: at(-DAY) }), NOW)).toBeNull();
    }
  });
});

/** An in-memory stand-in for the sent-record table. */
function harness(users: NoticeUser[], result: () => SendEmailResult = () => ({ ok: true, id: "x" })) {
  const records = new Map<string, Date | null>();
  const sent: SendEmailParams[] = [];
  const k = (id: string, n: DueNotice) => `${id}|${n.stage}|${n.periodEnd.toISOString()}`;
  return {
    records,
    sent,
    deps: {
      candidates: async () => users,
      claim: async (id: string, n: DueNotice) => {
        if (records.has(k(id, n))) return false;
        records.set(k(id, n), null);
        return true;
      },
      confirm: async (id: string, n: DueNotice, now: Date) => {
        records.set(k(id, n), now);
      },
      release: async (id: string, n: DueNotice) => {
        records.delete(k(id, n));
      },
      send: async (p: SendEmailParams) => {
        sent.push(p);
        return result();
      },
      subscriptionUrl: "https://mirpaa.app/subscription",
    },
  };
}

describe("sendDueNotices", () => {
  it("sends once, however many runs follow", async () => {
    const h = harness([user({ trialEndsAt: at(5 * DAY) })]);
    expect(await sendDueNotices(h.deps, NOW)).toBe(1);
    expect(await sendDueNotices(h.deps, at(HOUR))).toBe(0);
    expect(await sendDueNotices(h.deps, at(2 * HOUR))).toBe(0);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.to).toBe("therapist@example.com");
  });

  it("each stage goes out once, in order, over the life of a trial", async () => {
    const h = harness([user({ trialEndsAt: at(5 * DAY) })]);
    await sendDueNotices(h.deps, NOW);
    await sendDueNotices(h.deps, at(4.5 * DAY));
    await sendDueNotices(h.deps, at(4.6 * DAY));
    await sendDueNotices(h.deps, at(5.5 * DAY));
    await sendDueNotices(h.deps, at(5.6 * DAY));
    expect(h.sent.map((s) => s.subject.split(" — ")[0])).toEqual([
      "נותרו 5 ימים בתקופת הניסיון",
      "נותר יום אחד בתקופת הניסיון",
      "תקופת הניסיון הסתיימה",
    ]);
  });

  it("two runs at the same moment send one email", async () => {
    const h = harness([user({ trialEndsAt: at(5 * DAY) })]);
    await Promise.all([sendDueNotices(h.deps, NOW), sendDueNotices(h.deps, NOW)]);
    expect(h.sent).toHaveLength(1);
  });

  it("a renewal starts a new cycle", async () => {
    const h = harness([user({ subscriptionEndsAt: at(5 * DAY), subscriptionPlan: "MONTHLY" })]);
    await sendDueNotices(h.deps, NOW);
    const renewed = harness([user({ subscriptionEndsAt: at(35 * DAY), subscriptionPlan: "MONTHLY" })]);
    renewed.records.clear();
    for (const [k, v] of h.records) renewed.records.set(k, v);
    expect(await sendDueNotices(renewed.deps, at(29 * DAY))).toBe(1);
  });

  it("a failed send is tried again next run, and counted only when it works", async () => {
    let ok = false;
    const h = harness([user({ trialEndsAt: at(5 * DAY) })], () =>
      ok ? { ok: true, id: "x" } : { ok: false, error: "down" },
    );
    expect(await sendDueNotices(h.deps, NOW)).toBe(0);
    expect(h.records.size).toBe(0);
    ok = true;
    expect(await sendDueNotices(h.deps, at(HOUR))).toBe(1);
    expect(await sendDueNotices(h.deps, at(2 * HOUR))).toBe(0);
    expect(h.sent).toHaveLength(2);
  });

  it("a send that throws is treated like a failed one", async () => {
    const h = harness([user({ trialEndsAt: at(5 * DAY) })]);
    const deps = {
      ...h.deps,
      send: async (): Promise<SendEmailResult> => {
        throw new Error("boom");
      },
    };
    expect(await sendDueNotices(deps, NOW)).toBe(0);
    expect(h.records.size).toBe(0);
  });

  it("skips accounts that aren't due, exempt ones and unconfirmed addresses", async () => {
    const h = harness([
      user({ id: "exempt", subscriptionExempt: true, trialEndsAt: at(DAY) }),
      user({ id: "admin", isAdmin: true, trialEndsAt: at(DAY) }),
      user({ id: "unconfirmed", emailVerifiedAt: null, trialEndsAt: at(DAY) }),
      user({ id: "far", trialEndsAt: at(20 * DAY) }),
      user({ id: "old", trialEndsAt: at(-30 * DAY) }),
    ]);
    expect(await sendDueNotices(h.deps, NOW)).toBe(0);
    expect(h.sent).toHaveLength(0);
    expect(h.records.size).toBe(0);
  });

  it("stops at the per-run limit; the rest go next run", async () => {
    const users = Array.from({ length: MAX_PER_RUN + 3 }, (_, i) =>
      user({ id: `u${i}`, trialEndsAt: at(5 * DAY) }),
    );
    const h = harness(users);
    expect(await sendDueNotices(h.deps, NOW)).toBe(MAX_PER_RUN);
    expect(await sendDueNotices(h.deps, at(HOUR))).toBe(3);
  });
});

describe("the email", () => {
  const url = "https://mirpaa.app/subscription";
  const all: DueNotice[] = (["TRIAL", "SUBSCRIPTION"] as const).flatMap((kind) =>
    (["DAYS_7", "DAY_1", "ENDED"] as const).map((stage) => ({
      kind,
      stage,
      periodEnd: at(DAY),
      daysLeft: stage === "DAYS_7" ? 7 : stage === "DAY_1" ? 1 : 0,
    })),
  );

  it("links to the plans page and names the operator, in both versions", () => {
    for (const notice of all) {
      const e = buildSubscriptionNoticeEmail({ name: "דנה", notice, subscriptionUrl: url });
      for (const body of [e.html, e.text]) {
        expect(body).toContain(url);
        expect(body).toContain("מנוי ומסלולים");
        expect(body).toContain(OPERATOR_TRADE_NAME);
        expect(body).toContain(OPERATOR_EMAIL);
      }
      expect(e.replyTo).toBe(OPERATOR_EMAIL);
    }
  });

  it("has no unsubscribe link and none of the words public text may not use", () => {
    for (const notice of all) {
      const e = buildSubscriptionNoticeEmail({ name: "דנה", notice, subscriptionUrl: url });
      const body = `${e.subject} ${e.html} ${e.text}`;
      expect(body).not.toMatch(/הסרה מרשימ|unsubscribe|מע״מ|מע"מ|עוסק פטור/i);
    }
  });

  it("a name can't inject markup", () => {
    const e = buildSubscriptionNoticeEmail({ name: "<b>x</b>", notice: all[0]!, subscriptionUrl: url });
    expect(e.html).not.toContain("<b>x</b>");
  });

  it("says what happens next", () => {
    const warn = buildSubscriptionNoticeEmail({ name: "דנה", notice: all[0]!, subscriptionUrl: url });
    expect(warn.subject).toBe("נותרו 7 ימים בתקופת הניסיון — מרפאה אישית");
    expect(warn.text).toContain("אין חיוב אוטומטי");
    expect(warn.text).toContain("קריאה בלבד");
    const ended = buildSubscriptionNoticeEmail({ name: "דנה", notice: all[5]!, subscriptionUrl: url });
    expect(ended.subject).toBe("המנוי הסתיים — מרפאה אישית");
    expect(ended.text).toContain("קריאה בלבד");
  });
});
