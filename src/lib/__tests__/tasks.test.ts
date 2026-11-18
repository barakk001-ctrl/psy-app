import { describe, expect, it } from "vitest";
import {
  TASK_SUGGESTIONS,
  TASK_TITLE_MAX,
  badgeText,
  dashboardTasks,
  daysBetween,
  dueNowCount,
  dueText,
  groupTasks,
  isDay,
  sortOpenTasks,
  taskBucket,
} from "@/lib/tasks";

const TODAY = "2026-11-18"; // a Wednesday

const task = (id: string, dueDay: string | null, createdAt = "2026-11-01T08:00:00Z") => ({
  id,
  dueDay,
  createdAt,
});

describe("isDay", () => {
  it("accepts a real calendar day", () => {
    expect(isDay("2026-11-18")).toBe(true);
    expect(isDay("2028-02-29")).toBe(true);
  });

  it("refuses anything else", () => {
    for (const bad of ["", "2026-02-30", "2027-02-29", "18/11/2026", "2026-11-18T10:00", "2026-13-01", "1999-01-01", "abc"]) {
      expect(isDay(bad), bad).toBe(false);
    }
  });
});

describe("daysBetween", () => {
  it("counts whole days either way, across months and years", () => {
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween(TODAY, "2026-11-19")).toBe(1);
    expect(daysBetween(TODAY, "2026-11-11")).toBe(-7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    // across the autumn clock change (25 October 2026 in Israel)
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("taskBucket", () => {
  it("places a task against today", () => {
    expect(taskBucket(null, TODAY)).toBe("none");
    expect(taskBucket("2026-11-17", TODAY)).toBe("overdue");
    expect(taskBucket(TODAY, TODAY)).toBe("today");
    expect(taskBucket("2026-11-19", TODAY)).toBe("upcoming");
    expect(taskBucket("2025-12-31", TODAY)).toBe("overdue");
  });
});

describe("dueText", () => {
  it("names the near days", () => {
    expect(dueText(TODAY, TODAY)).toBe("היום");
    expect(dueText("2026-11-19", TODAY)).toBe("מחר");
    expect(dueText("2026-11-17", TODAY)).toBe("אתמול");
    expect(dueText("2026-11-16", TODAY)).toBe("שלשום");
    expect(dueText("2026-11-13", TODAY)).toBe("לפני 5 ימים");
  });

  it("gives the weekday for the coming week and the plain date after it", () => {
    expect(dueText("2026-11-20", TODAY)).toBe("יום שישי, 20.11");
    expect(dueText("2026-11-24", TODAY)).toBe("יום שלישי, 24.11");
    expect(dueText("2026-11-25", TODAY)).toBe("25.11");
    expect(dueText("2026-12-03", TODAY)).toBe("3.12");
  });

  it("adds the year only when it is another one", () => {
    expect(dueText("2027-01-05", TODAY)).toBe("5.1.27");
  });
});

describe("sortOpenTasks and groupTasks", () => {
  const rows = [
    task("undated-old", null, "2026-11-01T08:00:00Z"),
    task("later", "2026-12-01"),
    task("today", TODAY),
    task("undated-new", null, "2026-11-10T08:00:00Z"),
    task("overdue", "2026-11-10"),
    task("tomorrow", "2026-11-19"),
  ];

  it("puts dated tasks first by day, then undated ones newest first", () => {
    expect(sortOpenTasks(rows).map((t) => t.id)).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "later",
      "undated-new",
      "undated-old",
    ]);
  });

  it("does not change the list it was given", () => {
    const before = rows.map((t) => t.id);
    sortOpenTasks(rows);
    expect(rows.map((t) => t.id)).toEqual(before);
  });

  it("splits by where each task stands", () => {
    const g = groupTasks(rows, TODAY);
    expect(g.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(g.today.map((t) => t.id)).toEqual(["today"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["tomorrow", "later"]);
    expect(g.none.map((t) => t.id)).toEqual(["undated-new", "undated-old"]);
  });
});

describe("dashboardTasks", () => {
  it("leaves out tasks due more than a week ahead and says how many", () => {
    const rows = [task("a", "2026-11-10"), task("b", TODAY), task("c", "2026-11-25"), task("d", "2026-11-26"), task("e", null)];
    const { groups, shown, hidden } = dashboardTasks(rows, TODAY);
    expect(groups.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(groups.today.map((t) => t.id)).toEqual(["b"]);
    expect(groups.upcoming.map((t) => t.id)).toEqual(["c"]);
    expect(groups.none.map((t) => t.id)).toEqual(["e"]);
    expect(shown).toBe(4);
    expect(hidden).toBe(1);
  });

  it("fills up to the limit in order of urgency", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => task(`late${i}`, "2026-11-0" + (i + 1))),
      ...Array.from({ length: 3 }, (_, i) => task(`today${i}`, TODAY)),
      task("soon", "2026-11-20"),
      task("undated", null),
    ];
    const { groups, shown, hidden } = dashboardTasks(rows, TODAY, 6);
    expect(groups.overdue).toHaveLength(5);
    expect(groups.today).toHaveLength(1);
    expect(groups.upcoming).toHaveLength(0);
    expect(groups.none).toHaveLength(0);
    expect(shown).toBe(6);
    expect(hidden).toBe(4);
  });

  it("is empty for no tasks", () => {
    expect(dashboardTasks([], TODAY)).toEqual({
      groups: { overdue: [], today: [], upcoming: [], none: [] },
      shown: 0,
      hidden: 0,
    });
  });
});

describe("the menu count", () => {
  it("counts tasks due today or earlier, never undated or later ones", () => {
    const rows = [task("a", "2026-11-10"), task("b", TODAY), task("c", "2026-11-19"), task("d", null)];
    expect(dueNowCount(rows, TODAY)).toBe(2);
    expect(dueNowCount([], TODAY)).toBe(0);
  });

  it("caps the badge text", () => {
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
    expect(badgeText(140)).toBe("9+");
  });
});

describe("starting titles", () => {
  it("are short, distinct and within the title limit", () => {
    expect(new Set(TASK_SUGGESTIONS).size).toBe(TASK_SUGGESTIONS.length);
    for (const s of TASK_SUGGESTIONS) {
      expect(s.length).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(30);
      expect(s.length).toBeLessThanOrEqual(TASK_TITLE_MAX);
    }
  });
});
