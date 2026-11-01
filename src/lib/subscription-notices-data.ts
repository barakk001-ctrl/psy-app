// The database and email side of subscription-notices.ts.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { canonicalOrigin } from "@/lib/request-origin";
import { SITE_URL } from "@/lib/site";
import { SUBSCRIPTION_FIELD_SELECT } from "@/lib/subscription";
import {
  ENDED_WINDOW_DAYS,
  SEND_PAUSE_MS,
  WARN_DAYS,
  sendDueNotices,
  type DueNotice,
  type NoticeUser,
} from "@/lib/subscription-notices";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Accounts near an end, as a cheap filter; dueNotice makes the real decision.
 *  Exempt and admin accounts are left out here as well as in dueNotice. */
async function candidates(now: Date): Promise<NoticeUser[]> {
  const near = {
    gte: new Date(now.getTime() - (ENDED_WINDOW_DAYS + 1) * DAY_MS),
    lte: new Date(now.getTime() + WARN_DAYS * DAY_MS),
  };
  return db.user.findMany({
    where: {
      subscriptionExempt: false,
      isAdmin: false,
      emailVerifiedAt: { not: null },
      OR: [{ trialEndsAt: near }, { subscriptionEndsAt: near }, { trialEndsAt: null }],
    },
    select: {
      ...SUBSCRIPTION_FIELD_SELECT,
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

const key = (userId: string, n: DueNotice) => ({
  userId,
  stage: n.stage,
  periodEnd: n.periodEnd,
});

export function sendSubscriptionNotices(now = new Date()): Promise<number> {
  return sendDueNotices(
    {
      candidates,
      claim: async (userId, notice) => {
        // The unique (user, stage, period) decides who sends
        const { count } = await db.subscriptionNotice.createMany({
          data: [key(userId, notice)],
          skipDuplicates: true,
        });
        return count === 1;
      },
      confirm: async (userId, notice, at) => {
        await db.subscriptionNotice.updateMany({
          where: key(userId, notice),
          data: { sentAt: at },
        });
      },
      release: async (userId, notice) => {
        await db.subscriptionNotice.deleteMany({ where: { ...key(userId, notice), sentAt: null } });
      },
      send: sendEmail,
      subscriptionUrl: `${canonicalOrigin() ?? SITE_URL}/subscription`,
      pause: () => new Promise((r) => setTimeout(r, SEND_PAUSE_MS)),
    },
    now,
  );
}
