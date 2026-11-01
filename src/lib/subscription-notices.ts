// Emails to the account owner before and when a trial or subscription ends:
// 7 days before, 1 day before, and once it has ended. Rules here are pure and
// tested; the database side is subscription-notices-data.ts, and the hourly
// maintenance runs it. Only ever addressed to the therapist who owns the
// account (User.email) — never to anyone in her client list.

import type { SendEmailParams, SendEmailResult } from "@/lib/email";
import { buildSubscriptionNoticeEmail } from "@/lib/subscription-notice-email";
import {
  getSubscriptionState,
  trialEndOf,
  type SubscriptionFields,
} from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

export const WARN_DAYS = 7;
/** An account that ended longer ago than this is not written to (e.g. on the
 *  first run: someone whose trial ended months ago hears nothing new). */
export const ENDED_WINDOW_DAYS = 3;
/** Most emails in one hourly run; the rest go in the next. */
export const MAX_PER_RUN = 50;
/** Resend allows a couple of requests a second. */
export const SEND_PAUSE_MS = 600;

export type NoticeStage = "DAYS_7" | "DAY_1" | "ENDED";
export type NoticeKind = "TRIAL" | "SUBSCRIPTION";

export type DueNotice = {
  stage: NoticeStage;
  kind: NoticeKind;
  /** the end this notice is about: a renewed period is a new cycle of notices */
  periodEnd: Date;
  daysLeft: number;
};

/** Which notice this account should get now, if any. Exempt accounts: never. */
export function dueNotice(u: SubscriptionFields, now: Date): DueNotice | null {
  const state = getSubscriptionState(u, now);
  if (state.status === "exempt") return null;

  if (state.status === "expired") {
    const trialEnd = trialEndOf(u);
    const paidEnd = u.subscriptionEndsAt;
    const paidLast = !!paidEnd && paidEnd >= trialEnd;
    const periodEnd = paidLast ? paidEnd : trialEnd;
    if (now.getTime() - periodEnd.getTime() > ENDED_WINDOW_DAYS * DAY_MS) return null;
    return { stage: "ENDED", kind: paidLast ? "SUBSCRIPTION" : "TRIAL", periodEnd, daysLeft: 0 };
  }

  const periodEnd = state.activeUntil;
  if (!periodEnd) return null;
  const left = periodEnd.getTime() - now.getTime();
  if (left > WARN_DAYS * DAY_MS) return null;
  return {
    stage: left <= DAY_MS ? "DAY_1" : "DAYS_7",
    kind: state.status === "active" ? "SUBSCRIPTION" : "TRIAL",
    periodEnd,
    daysLeft: state.daysLeft ?? 0,
  };
}

export type NoticeUser = SubscriptionFields & {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
};

export type NoticeDeps = {
  candidates: (now: Date) => Promise<NoticeUser[]>;
  /** Takes the one sent-record for this user + stage + period; false if it exists. */
  claim: (userId: string, notice: DueNotice) => Promise<boolean>;
  confirm: (userId: string, notice: DueNotice, now: Date) => Promise<void>;
  /** The send failed: free the record so the next hourly run tries again. */
  release: (userId: string, notice: DueNotice) => Promise<void>;
  send: (params: SendEmailParams) => Promise<SendEmailResult>;
  subscriptionUrl: string;
  pause?: () => Promise<void>;
};

/**
 * One run. The record is taken before sending, so two runs at once (or the
 * hourly job and the cron route) can never both send: a crash between the two
 * loses that one email rather than doubling it.
 */
export async function sendDueNotices(deps: NoticeDeps, now: Date): Promise<number> {
  let sent = 0;
  let attempts = 0;
  for (const user of await deps.candidates(now)) {
    if (attempts >= MAX_PER_RUN) break;
    // An unconfirmed address may not be the sign-up's own, and such an account
    // was never used: it has no session until the address is confirmed.
    if (!user.emailVerifiedAt) continue;
    const notice = dueNotice(user, now);
    if (!notice) continue;
    if (!(await deps.claim(user.id, notice))) continue;

    attempts++;
    const email = buildSubscriptionNoticeEmail({
      name: user.name,
      notice,
      subscriptionUrl: deps.subscriptionUrl,
    });
    let result: SendEmailResult;
    try {
      result = await deps.send({ to: user.email, ...email });
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (result.ok) {
      await deps.confirm(user.id, notice, now);
      sent++;
    } else {
      await deps.release(user.id, notice);
    }
    await deps.pause?.();
  }
  return sent;
}
