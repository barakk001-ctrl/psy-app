import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSubscriptionState, type SubscriptionFields } from "@/lib/subscription";

// The central write lock for expired (read-only) accounts. Every exported
// server action must either call the lock — isReadOnly / requireWritable
// (src/lib/subscription-server.ts), or the older subscriptionReadOnly /
// `.writable` checks — or be on ALLOWED below, with the reason. A new action
// that does neither fails this test.

const ACTIONS_DIR = path.join(process.cwd(), "src", "server", "actions");
const API_DIR = path.join(process.cwd(), "src", "app", "api");
const LOCK = /\b(isReadOnly|requireWritable|subscriptionReadOnly)\(|\.writable\b/;

/** Stays usable on an expired account (sign-in, security, export, buying, support). */
const ALLOWED: Record<string, string> = {
  // signing in / out, registering, recovering the account
  "auth.signOutAction": "sign-out",
  "auth.idleSignOutAction": "sign-out",
  "auth.loginAction": "sign-in",
  "auth.registerAction": "creates a new (trial) account",
  "auth.requestPasswordResetAction": "account recovery",
  "auth.resetPasswordAction": "account recovery",
  "auth.googleSignInAction": "sign-in",
  "auth.googleRegisterAction": "sign-in",
  "auth.verifyTwoFactorAction": "sign-in",
  "auth.cancelTwoFactorAction": "sign-in",
  "auth.requestLoginCodeAction": "sign-in",
  "auth.verifyLoginCodeAction": "sign-in",
  // security settings
  "two-factor.startTotpEnrollmentAction": "2FA",
  "two-factor.confirmTotpEnrollmentAction": "2FA",
  "two-factor.regenerateBackupCodesAction": "2FA",
  "two-factor.disableTotpAction": "2FA",
  "settings.changePasswordAction": "password change",
  "settings.sendSetPasswordLinkAction": "password (Google-only accounts)",
  "settings.updateIdleTimeoutAction": "idle-timeout preference",
  "settings.acceptAgreementAction": "agreement acceptance",
  "settings.disconnectMorningAction": "disconnecting morning (removes keys)",
  "settings.calendarFeedDisableAction": "turning the calendar feed off (privacy)",
  "settings.setShowHolidaysAction": "calendar view preference, no data",
  "inbox.revokeInboxTokenAction": "revoking a token (security)",
  // reads only
  "sessions.checkOverlapAction": "read-only check",
  "sessions.sessionScopeInfoAction": "read-only lookup",
  "clients.clientDeletionPreviewAction": "read-only preview",
  // buying, support, admin
  "subscription.requestPlanAction": "plan purchase request",
  "subscription.startCardPaymentAction": "buying a plan",
  "subscription.extendSubscriptionAction": "admin (admins are exempt)",
  "subscription.toggleSubscriptionExemptAction": "admin (admins are exempt)",
  "support.submitSupportRequestAction": "support message",
  "support.setSupportRequestStatusAction": "admin, support inbox",
};

/** Mutating API routes that stay open: auth, system jobs, the payment webhook. */
const API_ALLOWED: Record<string, string> = {
  "auth/[...nextauth]": "sign-in",
  "cron/reminders": "system job (CRON_SECRET)",
  "billing/webhook": "payment provider callback — renews the account",
};

function exportedActions(): { key: string; body: string }[] {
  const out: { key: string; body: string }[] = [];
  for (const file of fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    const starts = [...src.matchAll(/^export async function (\w+)\s*\(/gm)];
    starts.forEach((m, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      out.push({ key: `${file.replace(/\.ts$/, "")}.${m[1]}`, body: src.slice(m.index!, end) });
    });
  }
  return out;
}

function apiRoutes(): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^route\.tsx?$/.test(e.name)) {
        out.push({ key: path.relative(API_DIR, dir).split(path.sep).join("/"), src: fs.readFileSync(p, "utf8") });
      }
    }
  };
  walk(API_DIR);
  return out;
}

describe("write lock coverage", () => {
  const actions = exportedActions();

  it("finds the server actions", () => {
    expect(actions.length).toBeGreaterThan(60);
  });

  it("every exported server action is gated or explicitly allowed", () => {
    const missing = actions.filter((a) => !LOCK.test(a.body) && !(a.key in ALLOWED)).map((a) => a.key);
    expect(missing).toEqual([]);
  });

  it("the allowlist has no stale names", () => {
    const keys = new Set(actions.map((a) => a.key));
    expect(Object.keys(ALLOWED).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("every API route that changes data is gated or explicitly allowed", () => {
    const mutating = apiRoutes().filter(
      (r) =>
        /export async function (POST|PUT|PATCH|DELETE)\b/.test(r.src) ||
        // GET handlers that write (the inbox's iOS-Shortcut fallback)
        /export async function GET[\s\S]*\.(create|update|upsert|delete)(Many)?\(/.test(r.src),
    );
    const missing = mutating.filter((r) => !LOCK.test(r.src) && !(r.key in API_ALLOWED)).map((r) => r.key);
    expect(missing).toEqual([]);
  });

  it("the calendar feed stops serving future meetings for a read-only account", () => {
    const feed = apiRoutes().find((r) => r.key === "calendar/[token]")!;
    expect(feed.src).toMatch(/isReadOnly\(/);
    expect(feed.src).toMatch(/lt: new Date\(\)/);
  });
});

describe("who the lock applies to", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const base: SubscriptionFields = {
    createdAt: new Date("2026-10-01T00:00:00Z"),
    trialEndsAt: null,
    subscriptionPlan: null,
    subscriptionEndsAt: null,
    subscriptionExempt: false,
    isAdmin: false,
  };
  const day = 24 * 60 * 60 * 1000;

  it("exempt accounts (Keren) and the admin (Barak) are always writable", () => {
    const longExpired = { trialEndsAt: new Date("2025-01-01"), subscriptionEndsAt: new Date("2025-02-01") };
    expect(getSubscriptionState({ ...base, ...longExpired, subscriptionExempt: true }, now).writable).toBe(true);
    expect(getSubscriptionState({ ...base, ...longExpired, isAdmin: true }, now).writable).toBe(true);
  });

  it("trial and paid accounts are writable", () => {
    expect(getSubscriptionState({ ...base, trialEndsAt: new Date(now.getTime() + 5 * day) }, now).writable).toBe(true);
    expect(
      getSubscriptionState(
        { ...base, trialEndsAt: new Date("2026-09-01"), subscriptionPlan: "MONTHLY", subscriptionEndsAt: new Date(now.getTime() + day) },
        now,
      ).writable,
    ).toBe(true);
  });

  it("only an expired account is read-only", () => {
    expect(getSubscriptionState({ ...base, trialEndsAt: new Date(now.getTime() - day) }, now).writable).toBe(false);
  });
});
