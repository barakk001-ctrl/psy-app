import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIENT_GROUPS,
  CLINIC_TYPE_MAX,
  CLINIC_TYPE_OPTIONS,
  FOCUS_OPTIONS,
  HOUR_CHOICES,
  INTRO_QUESTIONS,
  addWorkingDay,
  businessHoursFor,
  cleanClientGroups,
  cleanClientGroupsOther,
  cleanClinicType,
  cleanFocus,
  clientGroupsText,
  dashboardLayout,
  introAnswers,
  introHref,
  introRows,
  isIntroQuestionId,
  parseWorkingHours,
  workingHoursError,
  workingHoursText,
  workingSpan,
} from "@/lib/intro";
import { INTRO_STEPS, SETUP_STEPS } from "@/lib/onboarding";
import { introAnswersSchema } from "@/server/validators/intro";

const week = [
  { day: 0, from: "09:00", to: "19:00" },
  { day: 1, from: "09:00", to: "19:00" },
  { day: 2, from: "09:00", to: "19:00" },
  { day: 3, from: "09:00", to: "19:00" },
  { day: 4, from: "09:00", to: "19:00" },
  { day: 5, from: "08:00", to: "13:00" },
];

describe("the questions", () => {
  it("are seven, each with a title and a line of explanation", () => {
    expect(INTRO_QUESTIONS.map((q) => q.id)).toEqual(["type", "groups", "hours", "session", "focus", "color", "word"]);
    for (const q of INTRO_QUESTIONS) {
      expect(q.title.length).toBeGreaterThan(3);
      expect(q.subtitle.length).toBeGreaterThan(3);
    }
  });
  it("each answer has its own address for editing", () => {
    expect(introHref()).toBe("/my-clinic/intro");
    expect(introHref("hours")).toBe("/my-clinic/intro?q=hours");
    expect(isIntroQuestionId("focus")).toBe(true);
    expect(isIntroQuestionId("clients")).toBe(false);
    expect(isIntroQuestionId(undefined)).toBe(false);
  });
  it("the setup wizard asks every one of them, or already asked it in an earlier step", () => {
    const asked = Object.values(INTRO_STEPS).flat();
    // the usual length and price are the wizard's own "types" and "business" steps
    expect([...asked, "session"].sort()).toEqual(INTRO_QUESTIONS.map((q) => q.id).sort());
    const ids = SETUP_STEPS.map((s) => s.id);
    for (const step of Object.keys(INTRO_STEPS)) {
      expect(ids.indexOf(step as (typeof ids)[number])).toBeGreaterThan(ids.indexOf("types"));
      expect(ids.indexOf(step as (typeof ids)[number])).toBeLessThan(ids.indexOf("done"));
    }
    // the steps that existed before keep their place, so a saved step means the same
    expect(ids.slice(0, 3)).toEqual(["brand", "business", "types"]);
  });
});

describe("the kind of clinic", () => {
  it("is one tidy line, or nothing", () => {
    expect(cleanClinicType("  פסיכולוגיה   קלינית \n לילדים ")).toBe("פסיכולוגיה קלינית לילדים");
    expect(cleanClinicType("   ")).toBeNull();
    expect(cleanClinicType(null)).toBeNull();
    expect(cleanClinicType(5)).toBeNull();
    expect(cleanClinicType("א".repeat(200))).toHaveLength(CLINIC_TYPE_MAX);
  });
  it("every suggestion fits in the line", () => {
    for (const o of CLINIC_TYPE_OPTIONS) expect(o.length).toBeLessThanOrEqual(CLINIC_TYPE_MAX);
  });
});

describe("who is mostly treated", () => {
  it("keeps known groups only, once each, in the list's order", () => {
    expect(cleanClientGroups(["FAMILIES", "CHILDREN", "CHILDREN", "ROBOTS", 7])).toEqual(["CHILDREN", "FAMILIES"]);
    expect(cleanClientGroups("CHILDREN")).toEqual([]);
    expect(cleanClientGroups(null)).toEqual([]);
  });
  it("reads as a list of words", () => {
    expect(clientGroupsText(["CHILDREN", "TEENS"])).toBe("ילדים, נוער");
    expect(clientGroupsText([])).toBeNull();
    expect(CLIENT_GROUPS).toHaveLength(6);
  });
  it("offers parents, and keeps them in the list's order", () => {
    expect(CLIENT_GROUPS.find((g) => g.id === "PARENTS")?.label).toBe("הורים");
    expect(cleanClientGroups(["PARENTS", "CHILDREN"])).toEqual(["CHILDREN", "PARENTS"]);
    expect(clientGroupsText(["PARENTS", "CHILDREN"])).toBe("ילדים, הורים");
  });
  it("\"אחר\" keeps the practice's own words, tidied, after the groups", () => {
    expect(cleanClientGroupsOther("  אנשים   עם מוגבלות ")).toBe("אנשים עם מוגבלות");
    expect(cleanClientGroupsOther("   ")).toBeNull();
    expect(cleanClientGroupsOther(7)).toBeNull();
    expect(cleanClientGroupsOther("א".repeat(100))).toHaveLength(40);
    expect(clientGroupsText(["CHILDREN"], " סטודנטים ")).toBe("ילדים, סטודנטים");
    expect(clientGroupsText([], "סטודנטים")).toBe("סטודנטים");
    expect(clientGroupsText([], " ")).toBeNull();
  });
  it("the form's words are checked like the clinic type", () => {
    expect(introAnswersSchema.safeParse({ clientGroupsOther: "סטודנטים" }).success).toBe(true);
    expect(introAnswersSchema.safeParse({ clientGroupsOther: "א".repeat(41) }).success).toBe(false);
  });
});

describe("working days and hours", () => {
  it("reads back valid days only, one per day, Sunday first", () => {
    expect(
      parseWorkingHours([
        { day: 3, from: "10:00", to: "18:00" },
        { day: 0, from: "09:00", to: "17:00" },
        { day: 3, from: "07:00", to: "08:00" }, // the same day again
        { day: 7, from: "09:00", to: "17:00" }, // no such day
        { day: 1, from: "17:00", to: "09:00" }, // ends before it starts
        { day: 2, from: "9:00", to: "17:00" }, // not HH:mm
        { day: 4, from: "09:00", to: "25:00" },
        "junk",
        null,
      ]),
    ).toEqual([
      { day: 0, from: "09:00", to: "17:00" },
      { day: 3, from: "10:00", to: "18:00" },
    ]);
  });
  it("anything that is not a list reads as not answered", () => {
    for (const v of [null, undefined, "x", 5, {}, { day: 1 }]) expect(parseWorkingHours(v)).toEqual([]);
  });
  it("a day may run until midnight", () => {
    expect(parseWorkingHours([{ day: 4, from: "16:00", to: "24:00" }])).toHaveLength(1);
    expect(HOUR_CHOICES[0]).toBe("05:00");
    expect(HOUR_CHOICES[HOUR_CHOICES.length - 1]).toBe("24:00");
    expect(HOUR_CHOICES).toContain("13:30");
  });
  it("says what is wrong with a form's hours", () => {
    expect(workingHoursError(week)).toBeNull();
    expect(workingHoursError([])).toBeNull();
    expect(workingHoursError("x")).toBeTruthy();
    expect(workingHoursError([{ day: 1, from: "12:00", to: "12:00" }])).toMatch(/שעת הסיום/);
    expect(
      workingHoursError([
        { day: 1, from: "08:00", to: "12:00" },
        { day: 1, from: "13:00", to: "17:00" },
      ]),
    ).toBeTruthy();
  });
  it("greys the calendar outside them, and greys nothing when not answered", () => {
    expect(businessHoursFor([])).toBeUndefined();
    expect(businessHoursFor(week.slice(4))).toEqual([
      { daysOfWeek: [4], startTime: "09:00", endTime: "19:00" },
      { daysOfWeek: [5], startTime: "08:00", endTime: "13:00" },
    ]);
  });
  it("the working week's span is its earliest start and latest end", () => {
    expect(workingSpan([])).toBeNull();
    expect(workingSpan(week)).toEqual({ start: 8 * 60, end: 19 * 60 });
  });
  it("writes days in a row with the same hours as one range", () => {
    expect(workingHoursText(week)).toBe("א׳–ה׳ 09:00–19:00 · ו׳ 08:00–13:00");
    expect(workingHoursText(week.slice(0, 2))).toBe("א׳, ב׳ 09:00–19:00");
    expect(workingHoursText([week[0], week[2]])).toBe("א׳ 09:00–19:00 · ג׳ 09:00–19:00");
    expect(workingHoursText([])).toBeNull();
  });
  it("a day that is ticked starts with the hours of the nearest chosen day", () => {
    expect(addWorkingDay([], 2)).toEqual([{ day: 2, from: "08:00", to: "20:00" }]);
    expect(addWorkingDay(week.slice(4), 3)).toEqual([{ day: 3, from: "09:00", to: "19:00" }, ...week.slice(4)]);
    expect(addWorkingDay(week, 2)).toBe(week);
  });
});

describe("what matters most", () => {
  it("only the three known answers count", () => {
    expect(cleanFocus("PAYMENTS")).toBe("PAYMENTS");
    expect(cleanFocus("")).toBeNull();
    expect(cleanFocus("EVERYTHING")).toBeNull();
    expect(FOCUS_OPTIONS).toHaveLength(3);
  });
  it("with no answer the dashboard keeps its order", () => {
    expect(dashboardLayout(null)).toEqual({
      blocks: ["stats", "tiles", "today"],
      stats: ["clients", "expected", "income", "debt", "meetings"],
      tiles: ["document", "collect"],
    });
    expect(dashboardLayout("nonsense")).toEqual(dashboardLayout(null));
  });
  it("every answer reorders the same boxes and never drops one", () => {
    const base = dashboardLayout(null);
    for (const f of FOCUS_OPTIONS) {
      const l = dashboardLayout(f.id);
      expect([...l.blocks].sort()).toEqual([...base.blocks].sort());
      expect([...l.stats].sort()).toEqual([...base.stats].sort());
      expect([...l.tiles].sort()).toEqual([...base.tiles].sort());
    }
  });
  it("puts first what was chosen", () => {
    expect(dashboardLayout("CALENDAR").blocks[0]).toBe("today");
    expect(dashboardLayout("CALENDAR").stats[0]).toBe("meetings");
    expect(dashboardLayout("PAYMENTS").blocks[0]).toBe("stats");
    expect(dashboardLayout("PAYMENTS").stats.slice(0, 2)).toEqual(["income", "debt"]);
    expect(dashboardLayout("PAYMENTS").tiles[0]).toBe("collect");
    expect(dashboardLayout("NOTES").blocks[0]).toBe("tiles");
    expect(dashboardLayout("NOTES").tiles[0]).toBe("document");
  });
});

describe("the answers together", () => {
  const stored = {
    clinicType: " פסיכולוגיה חינוכית ",
    clientGroups: ["TEENS", "CHILDREN"],
    workingHours: week,
    dashboardFocus: "CALENDAR",
    defaultSessionMinutes: 50,
    defaultRate: "380",
  };
  it("reads the stored columns", () => {
    expect(introAnswers(stored)).toEqual({
      clinicType: "פסיכולוגיה חינוכית",
      clientGroups: ["CHILDREN", "TEENS"],
      clientGroupsOther: null,
      workingHours: week,
      dashboardFocus: "CALENDAR",
      colorTheme: "sage",
      clientWord: "clients",
      defaultSessionMinutes: 50,
      defaultRate: "380",
    });
    expect(introAnswers({ ...stored, colorTheme: "teal" }).colorTheme).toBe("teal");
    expect(introAnswers({ ...stored, colorTheme: "no such set" }).colorTheme).toBe("sage");
    expect(introAnswers({ ...stored, clientWord: "patients" }).clientWord).toBe("patients");
    expect(introAnswers({ ...stored, clientWord: "no such word" }).clientWord).toBe("clients");
  });
  it("an account that answered nothing reads as empty, not as an error", () => {
    const a = introAnswers({
      clinicType: null,
      clientGroups: undefined,
      workingHours: null,
      dashboardFocus: null,
      defaultSessionMinutes: 45,
      defaultRate: null,
    });
    expect(a).toMatchObject({ clinicType: null, clientGroups: [], workingHours: [], dashboardFocus: null });
    const rows = introRows(a, (r) => `${r} ₪`);
    expect(rows.map((r) => r.id)).toEqual(INTRO_QUESTIONS.map((q) => q.id));
    expect(rows.filter((r) => r.value === null).map((r) => r.id)).toEqual(["type", "groups", "hours", "focus"]);
    expect(rows.find((r) => r.id === "session")?.value).toBe("45 דקות");
    // the colour is never "not answered": it names the set the account is in
    expect(rows.find((r) => r.id === "color")?.value).toBe("מרווה");
    // nor is the word: לקוחות until another is chosen
    expect(rows.find((r) => r.id === "word")?.value).toBe("לקוחות");
  });
  it("shows each answer on the card of the clinic's page", () => {
    const rows = introRows(introAnswers(stored), (r) => `${r} ₪`);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.value]))).toEqual({
      type: "פסיכולוגיה חינוכית",
      groups: "ילדים, נוער",
      hours: "א׳–ה׳ 09:00–19:00 · ו׳ 08:00–13:00",
      session: "50 דקות · 380 ₪",
      focus: "היומן והפגישות",
      color: "מרווה",
      word: "לקוחות",
    });
    const ocean = introRows(introAnswers({ ...stored, colorTheme: "ocean" }), (r) => r);
    expect(ocean.find((r) => r.id === "color")?.value).toBe("כחול ים");
    const counselees = introRows(introAnswers({ ...stored, clientWord: "counselees" }), (r) => r);
    expect(counselees.find((r) => r.id === "word")?.value).toBe("נועצים");
  });
});

describe("what the form may send", () => {
  it("takes any one answer by itself", () => {
    expect(introAnswersSchema.parse({ clinicType: " קליניקה " })).toEqual({ clinicType: "קליניקה" });
    expect(introAnswersSchema.parse({})).toEqual({});
    expect(introAnswersSchema.parse({ colorTheme: "ocean" })).toEqual({ colorTheme: "ocean" });
    expect(introAnswersSchema.parse({ clientWord: "patients" })).toEqual({ clientWord: "patients" });
    expect(introAnswersSchema.parse({ defaultRate: "" })).toEqual({ defaultRate: null });
    expect(introAnswersSchema.parse({ defaultRate: "0" })).toEqual({ defaultRate: 0 });
    expect(introAnswersSchema.parse({ defaultRate: "350.5", defaultSessionMinutes: "50" })).toEqual({
      defaultRate: 350.5,
      defaultSessionMinutes: 50,
    });
  });
  it("refuses what cannot be an answer", () => {
    expect(introAnswersSchema.safeParse({ defaultRate: "-5" }).success).toBe(false);
    expect(introAnswersSchema.safeParse({ defaultRate: "abc" }).success).toBe(false);
    expect(introAnswersSchema.safeParse({ defaultRate: "99999999" }).success).toBe(false);
    expect(introAnswersSchema.safeParse({ clinicType: "א".repeat(CLINIC_TYPE_MAX + 1) }).success).toBe(false);
    expect(introAnswersSchema.safeParse({ workingHours: [{ day: 1, from: "10:00", to: "09:00" }] }).success).toBe(false);
    expect(introAnswersSchema.safeParse({ defaultSessionMinutes: "0" }).success).toBe(false);
  });
  it("refuses any other field of the account", () => {
    for (const key of ["email", "passwordHash", "subscriptionExempt", "trialEndsAt", "introDoneAt", "id"]) {
      expect(introAnswersSchema.safeParse({ [key]: "x" }).success).toBe(false);
    }
  });
});

describe("the migration", () => {
  it("only adds optional columns to the account", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "prisma/migrations/20261118150000_intro_questionnaire/migration.sql"),
      "utf8",
    );
    const statements = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(statements).toMatch(/ALTER TABLE "User" ADD COLUMN/);
    expect(statements).not.toMatch(/DROP|DELETE|UPDATE|RENAME|NOT NULL|ALTER COLUMN/i);
  });
});
