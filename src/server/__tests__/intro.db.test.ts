import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";

// The שאלון היכרות against a real Postgres: each answer is saved on the
// signed-in practice's own row and nowhere else, an expired account is
// refused, and a new meeting takes its price in the documented order.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "intro");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null } };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const WEEK = [
  { day: 0, from: "09:00", to: "19:00" },
  { day: 2, from: "09:00", to: "19:00" },
  { day: 5, from: "08:00", to: "13:00" },
];

const ANSWERS = ["clinicType", "clientGroups", "workingHours", "dashboardFocus", "introDoneAt"] as const;

describe.skipIf(!TEST_DATABASE_URL)("שאלון היכרות (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;
  let b: Practice;
  let actions: typeof import("@/server/actions/intro");

  const answersOf = (userId: string) =>
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        clinicType: true,
        clientGroups: true,
        clientGroupsOther: true,
        workingHours: true,
        dashboardFocus: true,
        colorTheme: true,
        clientWord: true,
        introDoneAt: true,
        defaultSessionMinutes: true,
        defaultRate: true,
      },
    });

  const expire = (userId: string) =>
    db.user.update({
      where: { id: userId },
      data: {
        subscriptionExempt: false,
        subscriptionPlan: "MONTHLY",
        subscriptionEndsAt: new Date(Date.now() - 86_400_000),
        trialEndsAt: new Date(Date.now() - 86_400_000),
      },
    });

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("intro");
    db = (await import("@/lib/db")).dbAll;
    actions = await import("@/server/actions/intro");
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    b = await seedPractice(db, "B");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  it("a new account has answered nothing", async () => {
    expect(await answersOf(a.userId)).toMatchObject({
      clinicType: null,
      clientGroups: [],
      clientGroupsOther: null,
      workingHours: null,
      dashboardFocus: null,
      introDoneAt: null,
    });
  });

  it("\"הורים\" is a group, and \"אחר\" keeps the practice's own words until cleared", async () => {
    expect(
      await actions.saveIntroAnswersAction({ clientGroups: ["PARENTS", "CHILDREN"], clientGroupsOther: "  סטודנטים " }),
    ).toEqual({ ok: true });
    expect(await answersOf(a.userId)).toMatchObject({
      clientGroups: ["CHILDREN", "PARENTS"],
      clientGroupsOther: "סטודנטים",
    });
    // the other practice is untouched
    expect(await answersOf(b.userId)).toMatchObject({ clientGroups: [], clientGroupsOther: null });
    await actions.saveIntroAnswersAction({ clientGroups: ["CHILDREN"], clientGroupsOther: "" });
    expect(await answersOf(a.userId)).toMatchObject({ clientGroups: ["CHILDREN"], clientGroupsOther: null });
    // too long is refused, nothing saved
    expect((await actions.saveIntroAnswersAction({ clientGroupsOther: "א".repeat(41) })).error).toBeTruthy();
    expect((await answersOf(a.userId)).clientGroupsOther).toBeNull();
  });

  it("saves every answer on the practice's own row", async () => {
    expect(
      await actions.saveIntroAnswersAction({
        clinicType: "  פסיכולוגיה   חינוכית ",
        clientGroups: ["TEENS", "CHILDREN", "ROBOTS"],
        workingHours: WEEK,
        dashboardFocus: "PAYMENTS",
        defaultSessionMinutes: "50",
        defaultRate: "380",
      }),
    ).toEqual({ ok: true });
    const row = await answersOf(a.userId);
    expect(row).toMatchObject({
      clinicType: "פסיכולוגיה חינוכית",
      clientGroups: ["CHILDREN", "TEENS"],
      workingHours: WEEK,
      dashboardFocus: "PAYMENTS",
      defaultSessionMinutes: 50,
    });
    expect(row.defaultRate?.toString()).toBe("380");
    // saving answers is not finishing the questionnaire
    expect(row.introDoneAt).toBeNull();
  });

  it("saves only the answers that were sent, and an empty one clears", async () => {
    await actions.saveIntroAnswersAction({ clinicType: "פסיכותרפיה", clientGroups: ["ADULTS"], workingHours: WEEK });
    expect(await actions.saveIntroAnswersAction({ dashboardFocus: "NOTES" })).toEqual({ ok: true });
    expect(await answersOf(a.userId)).toMatchObject({
      clinicType: "פסיכותרפיה",
      clientGroups: ["ADULTS"],
      workingHours: WEEK,
      dashboardFocus: "NOTES",
    });

    expect(
      await actions.saveIntroAnswersAction({ clinicType: " ", clientGroups: [], workingHours: [], dashboardFocus: "" }),
    ).toEqual({ ok: true });
    expect(await answersOf(a.userId)).toMatchObject({
      clinicType: null,
      clientGroups: [],
      workingHours: null,
      dashboardFocus: null,
    });

    await actions.saveIntroAnswersAction({ defaultRate: "400" });
    expect(await actions.saveIntroAnswersAction({ defaultRate: "" })).toEqual({ ok: true });
    expect((await answersOf(a.userId)).defaultRate).toBeNull();
  });

  it("refuses what is not an answer, with a message, and saves nothing of it", async () => {
    const before = await answersOf(a.userId);
    for (const bad of [
      { workingHours: [{ day: 1, from: "18:00", to: "09:00" }] },
      { workingHours: "always" },
      { defaultRate: "-10" },
      { defaultSessionMinutes: "0" },
      { clinicType: "א".repeat(61) },
      // any other field of the account
      { clinicType: "קליניקה", subscriptionExempt: true },
      { email: "someone-else@example.test" },
      "not an object",
      null,
    ]) {
      const res = await actions.saveIntroAnswersAction(bad);
      expect(res.error).toMatch(/[֐-׿]/);
    }
    expect(await answersOf(a.userId)).toEqual(before);
  });

  it("one practice's answers never touch another's", async () => {
    const before = await answersOf(b.userId);
    await actions.saveIntroAnswersAction({
      clinicType: "טיפול זוגי ומשפחתי",
      clientGroups: ["COUPLES"],
      workingHours: WEEK,
      dashboardFocus: "CALENDAR",
      defaultRate: "500",
    });
    await actions.finishIntroAction();
    expect(await answersOf(b.userId)).toEqual(before);
    for (const key of ANSWERS) expect(JSON.stringify((await answersOf(b.userId))[key])).not.toContain("זוגי");
  });

  it("the colour set: a known set is saved, anything else is the default, on this account only", async () => {
    expect((await answersOf(a.userId)).colorTheme).toBeNull();
    expect(await actions.saveIntroAnswersAction({ colorTheme: "ocean" })).toEqual({ ok: true });
    expect((await answersOf(a.userId)).colorTheme).toBe("ocean");
    expect((await answersOf(b.userId)).colorTheme).toBeNull();
    // saving another answer leaves the set alone
    await actions.saveIntroAnswersAction({ clinicType: "פסיכותרפיה" });
    expect((await answersOf(a.userId)).colorTheme).toBe("ocean");
    // the default set is stored as "nothing chosen"; so is a value that is no set at all
    await actions.saveIntroAnswersAction({ colorTheme: "sage" });
    expect((await answersOf(a.userId)).colorTheme).toBeNull();
    await actions.saveIntroAnswersAction({ colorTheme: "mauve" });
    await actions.saveIntroAnswersAction({ colorTheme: "</style>" });
    expect((await answersOf(a.userId)).colorTheme).toBeNull();
    // and an expired account keeps the set it had
    await actions.saveIntroAnswersAction({ colorTheme: "teal" });
    await expire(a.userId);
    expect((await actions.saveIntroAnswersAction({ colorTheme: "slate" })).error).toBeTruthy();
    expect((await answersOf(a.userId)).colorTheme).toBe("teal");
  });

  it("the word for clients: a known word is saved, anything else is the default, on this account only", async () => {
    const { sayTo } = await import("@/lib/client-word-server");
    expect((await answersOf(a.userId)).clientWord).toBeNull();
    expect(await actions.saveIntroAnswersAction({ clientWord: "patients" })).toEqual({ ok: true });
    expect((await answersOf(a.userId)).clientWord).toBe("patients");
    expect((await answersOf(b.userId)).clientWord).toBeNull();
    expect(await sayTo(a.userId, "לקוח/ה לא נמצא/ה")).toBe("מטופל/ת לא נמצא/ה");
    expect(await sayTo(b.userId, "לקוח/ה לא נמצא/ה")).toBe("לקוח/ה לא נמצא/ה");
    // saving another answer leaves the word alone
    await actions.saveIntroAnswersAction({ colorTheme: "ocean" });
    expect((await answersOf(a.userId)).clientWord).toBe("patients");
    // "לקוחות" is stored as "nothing chosen"; so is a value that is no word at all
    await actions.saveIntroAnswersAction({ clientWord: "clients" });
    expect((await answersOf(a.userId)).clientWord).toBeNull();
    await actions.saveIntroAnswersAction({ clientWord: "counselees" });
    expect((await answersOf(a.userId)).clientWord).toBe("counselees");
    await actions.saveIntroAnswersAction({ clientWord: "<b>" });
    expect((await answersOf(a.userId)).clientWord).toBeNull();
    // an expired account keeps the word it had
    await actions.saveIntroAnswersAction({ clientWord: "patients" });
    await expire(a.userId);
    expect((await actions.saveIntroAnswersAction({ clientWord: "counselees" })).error).toBeTruthy();
    expect((await answersOf(a.userId)).clientWord).toBe("patients");
    // nothing but the wording changes: no row of either account is touched
    expect(await db.client.count({ where: { userId: a.userId } })).toBeGreaterThan(0);
  });

  it("finishing is remembered once, and a second time changes nothing", async () => {
    expect(await actions.finishIntroAction()).toEqual({ ok: true });
    const first = (await answersOf(a.userId)).introDoneAt;
    expect(first).toBeInstanceOf(Date);
    expect(await actions.finishIntroAction()).toEqual({ ok: true });
    expect((await answersOf(a.userId)).introDoneAt).toEqual(first);
    expect((await answersOf(b.userId)).introDoneAt).toBeNull();
  });

  it("the setup wizard ends the questionnaire with it", async () => {
    await db.user.update({ where: { id: a.userId }, data: { onboardingCompletedAt: null, onboardingStep: 0 } });
    const { setOnboardingStepAction } = await import("@/server/actions/onboarding");
    const { LAST_STEP } = await import("@/lib/onboarding");
    expect(await setOnboardingStepAction(LAST_STEP - 1)).toEqual({ ok: true });
    expect((await answersOf(a.userId)).introDoneAt).toBeNull();
    expect(await setOnboardingStepAction(LAST_STEP)).toEqual({ ok: true });
    expect((await answersOf(a.userId)).introDoneAt).toBeInstanceOf(Date);
  });

  it("refuses everything on an expired account", async () => {
    await expire(a.userId);
    const before = await answersOf(a.userId);
    expect((await actions.saveIntroAnswersAction({ clinicType: "פסיכותרפיה" })).error).toBeTruthy();
    expect((await actions.finishIntroAction()).error).toBeTruthy();
    expect(await answersOf(a.userId)).toEqual(before);
  });

  it("nobody signed in saves nothing", async () => {
    mocks.actor.id = null;
    await expect(actions.saveIntroAnswersAction({ clinicType: "פסיכותרפיה" })).rejects.toThrow("REDIRECT:/login");
    await expect(actions.finishIntroAction()).rejects.toThrow("REDIRECT:/login");
    expect((await answersOf(a.userId)).clinicType).toBeNull();
  });

  describe("the price of a new meeting", () => {
    const create = async (fields: Record<string, string>) => {
      const { createSessionAction } = await import("@/server/actions/sessions");
      const before = new Set((await db.session.findMany({ where: { userId: a.userId }, select: { id: true } })).map((s) => s.id));
      await expect(
        createSessionAction(
          null,
          form({ clientId: a.clientId, startsAt: "2030-03-05T10:00", durationMinutes: "50", location: "OFFICE", ...fields }),
        ),
      ).rejects.toThrow(/REDIRECT:\/sessions\//);
      const made = (await db.session.findMany({ where: { userId: a.userId } })).filter((s) => !before.has(s.id));
      expect(made).toHaveLength(1);
      return made[0].rate === null ? null : made[0].rate.toString();
    };
    const setRates = async (client: string | null, practice: string | null) => {
      await db.client.update({ where: { id: a.clientId }, data: { defaultRate: client } });
      await db.user.update({ where: { id: a.userId }, data: { defaultRate: practice } });
    };

    it("what was typed wins over both rates", async () => {
      await setRates("400", "350");
      expect(await create({ rate: "300" })).toBe("300");
    });
    it("an empty field takes the client's own rate", async () => {
      await setRates("400", "350");
      expect(await create({})).toBe("400");
    });
    it("a client with no rate takes the practice's usual rate", async () => {
      await setRates(null, "350");
      expect(await create({})).toBe("350");
    });
    it("a client seen at no charge is not given the practice's rate", async () => {
      await setRates("0", "350");
      expect(await create({})).toBe("0");
    });
    it("no rate anywhere stays empty, and another practice's rate is never used", async () => {
      await setRates(null, null);
      await db.user.update({ where: { id: b.userId }, data: { defaultRate: "999" } });
      expect(await create({})).toBeNull();
    });
  });
});
