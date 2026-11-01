import bcrypt from "bcryptjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { crossLinks, fingerprint, seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "account_closure");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null }, emails: [] as { to: string; subject: string }[] };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
  signOut: async () => undefined,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "mirpaa.app", "x-forwarded-proto": "https" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: { to: string; subject: string }) => {
    mocks.emails.push(m);
    return { ok: true };
  },
}));

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = "סיסמה-בדויה-1";

describe.skipIf(!TEST_DATABASE_URL)("closing an account (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;
  let b: Practice;

  const account = () => import("@/server/actions/account");
  const data = () => import("@/lib/account-closure-data");

  const good = { confirm: "סגירת החשבון", ack: "on", reauth: PASSWORD };

  async function close(fields: Record<string, string> = good) {
    try {
      return await (await account()).closeAccountAction(form(fields));
    } catch (err) {
      return { redirected: err instanceof Error ? err.message : String(err) };
    }
  }

  async function restore() {
    await (await account()).restoreAccountAction().catch(() => undefined); // it redirects
  }

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("account_closure");
    db = (await import("@/lib/db")).dbAll;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    b = await seedPractice(db, "B");
    await db.user.update({
      where: { id: a.userId },
      data: { hashedPassword: await bcrypt.hash(PASSWORD, 4) },
    });
    mocks.actor.id = a.userId;
    mocks.emails.length = 0;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  const state = (userId: string) =>
    db.user.findUnique({ where: { id: userId }, select: { closedAt: true, purgeAfter: true } });

  describe("closing", () => {
    it("needs the typed phrase, the acknowledgement and the re-check", async () => {
      await close({ ...good, confirm: "סגירה" });
      await close({ ...good, ack: "" });
      await close({ ...good, reauth: "שגויה" });
      await close({ ...good, reauth: "" });
      expect((await state(a.userId))?.closedAt).toBeNull();
    });

    it("closes for 30 days, stops reminders, tells the owner and the operator, and logs it", async () => {
      await close();
      const s = await state(a.userId);
      expect(s?.closedAt).toBeInstanceOf(Date);
      expect(s!.purgeAfter!.getTime() - s!.closedAt!.getTime()).toBe(30 * DAY);
      expect(await db.reminderJob.count({ where: { userId: a.userId, status: "PENDING" } })).toBe(0);
      expect(await db.reminderJob.count({ where: { userId: b.userId, status: "PENDING" } })).toBe(1);
      expect(await db.auditLog.count({ where: { userId: a.userId, action: "ACCOUNT_CLOSE" } })).toBe(1);
      expect(mocks.emails.map((e) => e.to)).toContain(a.email);
      expect(mocks.emails).toHaveLength(2);
    });

    it("the operator's account can't be closed", async () => {
      await db.user.update({ where: { id: a.userId }, data: { isAdmin: true } });
      const res = await close();
      expect(res).toEqual({ error: expect.any(String) });
      expect((await state(a.userId))?.closedAt).toBeNull();
    });

    it("works on an expired account, which is otherwise read-only", async () => {
      await db.user.update({
        where: { id: a.userId },
        data: { subscriptionExempt: false, trialEndsAt: new Date("2025-01-01") },
      });
      await close();
      expect((await state(a.userId))?.closedAt).toBeInstanceOf(Date);
    });
  });

  describe("a closed account", () => {
    beforeEach(async () => {
      await close();
    });

    it("can't change anything, and the write lock says so", async () => {
      const { isReadOnly, subscriptionStateFor } = await import("@/lib/subscription-server");
      expect(await isReadOnly(a.userId)).toBe(true);
      expect((await subscriptionStateFor(a.userId)).writable).toBe(false);
      const { addWaitlistEntryAction } = await import("@/server/actions/waitlist");
      const res = await addWaitlistEntryAction(null, form({ fullName: "חדש" }));
      expect(res).toEqual({ error: expect.any(String) });
      expect(await db.waitlistEntry.count({ where: { userId: a.userId } })).toBe(1);
    });

    it("its calendar feed, inbox key and public form stop", async () => {
      const feed = await (await import("@/app/api/calendar/[token]/route")).GET(new Request("http://t/x"), {
        params: Promise.resolve({ token: a.calendarToken }),
      });
      expect(feed.status).toBe(404);
      const inbox = await (await import("@/app/api/inbox/route")).POST(
        new Request("http://t/api/inbox", {
          method: "POST",
          body: "הודעה",
          headers: { authorization: `Bearer ${a.inboxApiToken}`, "content-type": "text/plain" },
        }),
      );
      expect(inbox.status).toBe(403);
      const { submitAppointmentRequestAction } = await import("@/server/actions/inbox");
      const res = await submitAppointmentRequestAction(
        null,
        form({ token: a.inboxToken, name: "פונה", phone: "0500000000" }),
      );
      expect(res?.sent).toBeUndefined();
    });

    it("its open-ended series stop growing", async () => {
      await db.session.updateMany({
        where: { userId: a.userId, recurrenceRule: { not: null } },
        data: { recurrenceRule: "FREQ=WEEKLY;INTERVAL=1" },
      });
      const before = await db.session.count({ where: { userId: a.userId } });
      const { topUpOpenEndedSeries } = await import("@/lib/series-topup");
      await topUpOpenEndedSeries();
      expect(await db.session.count({ where: { userId: a.userId } })).toBe(before);
    });

    it("gets no emails about its subscription ending", async () => {
      await db.user.update({
        where: { id: a.userId },
        data: { subscriptionExempt: false, trialEndsAt: new Date(Date.now() - DAY), emailVerifiedAt: new Date() },
      });
      mocks.emails.length = 0;
      const { sendSubscriptionNotices } = await import("@/lib/subscription-notices-data");
      await sendSubscriptionNotices(new Date());
      expect(mocks.emails.filter((e) => e.to === a.email)).toEqual([]);
    });

    it("can still download everything", async () => {
      const { prepareAccountExportAction } = await account();
      expect(await prepareAccountExportAction(form({ reauth: PASSWORD }))).toHaveProperty("grant");
    });

    it("can be restored as it was, reminders included", async () => {
      await restore();
      const s = await state(a.userId);
      expect(s).toEqual({ closedAt: null, purgeAfter: null });
      const { isReadOnly } = await import("@/lib/subscription-server");
      expect(await isReadOnly(a.userId)).toBe(false);
      expect(await db.auditLog.count({ where: { userId: a.userId, action: "ACCOUNT_RESTORE" } })).toBe(1);
      expect(await db.client.count({ where: { userId: a.userId } })).toBe(3);
      expect(await db.reminderJob.count({ where: { userId: a.userId, status: "PENDING" } })).toBeGreaterThan(0);
    });

    it("a restored account is never purged", async () => {
      await restore();
      const { purgeClosedAccounts } = await data();
      expect(await purgeClosedAccounts(new Date(Date.now() + 365 * DAY))).toBe(0);
      expect(await db.user.count({ where: { id: a.userId } })).toBe(1);
    });

    it("can't be restored once the grace period is over", async () => {
      const { restoreAccount } = await data();
      expect(await restoreAccount(a.userId, new Date(Date.now() + 31 * DAY))).toBe(false);
    });
  });

  describe("the purge", () => {
    const later = () => new Date(Date.now() + 31 * DAY);

    it("waits out the 30 days", async () => {
      await close();
      const { purgeClosedAccounts } = await data();
      expect(await purgeClosedAccounts(new Date(Date.now() + 29 * DAY))).toBe(0);
      expect(await db.user.count({ where: { id: a.userId } })).toBe(1);
    });

    it("purging A deletes everything of A and leaves B exactly as it was", async () => {
      await close();
      const before = await fingerprint(db, b.userId);
      const { purgeClosedAccounts } = await data();
      expect(await purgeClosedAccounts(later())).toBe(1);

      expect(await fingerprint(db, b.userId)).toBe(before);
      expect(await crossLinks(db)).toEqual([]);

      // No table holds A any more: every text column of every table is searched
      const columns = await db.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name <> '_prisma_migrations'
          AND data_type IN ('text', 'character varying')`);
      const hits: string[] = [];
      for (const { table_name: t, column_name: c } of columns) {
        const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "${t}" WHERE "${c}" = ANY($1)`,
          [a.userId, a.email, a.clientId, a.sessionId, a.documentId, a.fileId, a.oldInvoiceId],
        );
        if (Number(rows[0].n) > 0) hits.push(`${t}.${c}`);
      }
      // One id-only row proves the purge ran
      expect(hits).toEqual(["AuditLog.userId"]);
      expect(await db.auditLog.findMany({ where: { userId: a.userId }, select: { action: true, clientId: true, sessionId: true } })).toEqual([
        { action: "ACCOUNT_PURGE", clientId: null, sessionId: null },
      ]);

      // Canaries, in any text, anywhere
      for (const { table_name: t, column_name: c } of columns) {
        const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "${t}" WHERE "${c}" LIKE $1`,
          `%${a.canary}%`,
        );
        expect([t, c, Number(rows[0].n)]).toEqual([t, c, 0]);
      }
    }, 30_000);

    it("keeps the operator's payment record, with nothing about the person", async () => {
      await close();
      await (await data()).purgeClosedAccounts(later());
      const row = await db.billingEvent.findFirst({ where: { transactionId: `tx-${a.tag}` } });
      expect(row).toMatchObject({ userId: null, raw: null, amount: 100, plan: "MONTHLY" });
    });

    it("the address is free again, and the owner is told", async () => {
      await close();
      mocks.emails.length = 0;
      await (await data()).purgeClosedAccounts(later());
      expect(mocks.emails.map((e) => e.to)).toEqual([a.email]);
      expect(await db.user.count({ where: { email: a.email } })).toBe(0);
    });

    it("runs from the hourly job, and running twice does nothing more", async () => {
      await close();
      const { runMaintenance } = await import("@/server/maintenance");
      expect((await runMaintenance(later())).accountsPurged).toBe(1);
      expect((await runMaintenance(later())).accountsPurged).toBe(0);
    }, 30_000);

    it("never touches an account its owner didn't close, whatever its subscription says", async () => {
      const longAgo = new Date("2020-01-01");
      await db.user.update({
        where: { id: a.userId },
        data: { subscriptionExempt: true, trialEndsAt: longAgo, subscriptionEndsAt: longAgo },
      });
      await db.user.update({
        where: { id: b.userId },
        data: { subscriptionExempt: false, trialEndsAt: longAgo, subscriptionEndsAt: longAgo },
      });
      const { runMaintenance } = await import("@/server/maintenance");
      const res = await runMaintenance(new Date(Date.now() + 10 * 365 * DAY));
      expect(res.accountsPurged).toBe(0);
      expect(await db.user.count({ where: { id: { in: [a.userId, b.userId] } } })).toBe(2);
      expect(await state(a.userId)).toEqual({ closedAt: null, purgeAfter: null });
      expect(await state(b.userId)).toEqual({ closedAt: null, purgeAfter: null });
    }, 30_000);

    it("an exempt account closes only by the same deliberate path, and keeps its 30 days", async () => {
      expect((await db.user.findUnique({ where: { id: a.userId } }))?.subscriptionExempt).toBe(true);
      await close();
      const { purgeClosedAccounts } = await data();
      expect(await purgeClosedAccounts(new Date(Date.now() + 29 * DAY))).toBe(0);
      await restore();
      expect((await state(a.userId))?.closedAt).toBeNull();
    });

    it("never purges the operator, even with closure dates set by hand", async () => {
      await db.user.update({
        where: { id: a.userId },
        data: { isAdmin: true, closedAt: new Date("2020-01-01"), purgeAfter: new Date("2020-01-31") },
      });
      expect(await (await data()).purgeClosedAccounts(later())).toBe(0);
      expect(await db.user.count({ where: { id: a.userId } })).toBe(1);
    });
  });

  it("the operator's list shows pending closures", async () => {
    await close();
    const rows = await (await data()).pendingClosures();
    expect(rows.map((r) => r.email)).toEqual([a.email]);
  });
});
