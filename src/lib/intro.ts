// The "שאלון היכרות": a few questions about the practice itself (never about
// clients), asked once after sign-up and offered to existing accounts from a
// card at the top of "המרפאה שלי". Every answer is optional, changes one thing
// in the app today, and is kept for the personal guide that comes later.
// Pure rules, tested in intro.test.ts; saved by src/server/actions/intro.ts.
//
//   type    → a line under the clinic's name in the menus       (User.clinicType)
//   groups  → which starting task titles are offered first      (User.clientGroups)
//   hours   → the calendar greys the rest, and blocks nothing   (User.workingHours)
//   session → what a new meeting opens with                     (User.defaultSessionMinutes, defaultRate)
//   focus   → the order of the dashboard's boxes                (User.dashboardFocus)
//   color   → the interface's colour set, src/lib/color-themes  (User.colorTheme)
//
// "session" adds no column: the usual length and price were already settings
// (Settings → calendar / business); the questionnaire edits the same two.

import { cleanColorTheme, colorTheme, DEFAULT_THEME_ID, type ColorThemeId } from "@/lib/color-themes";

export const INTRO_PATH = "/my-clinic/intro";
export const INTRO_TITLE = "שאלון היכרות";

export type IntroQuestionId = "type" | "groups" | "hours" | "session" | "focus" | "color";

export type IntroQuestion = { id: IntroQuestionId; title: string; subtitle: string };

export const INTRO_QUESTIONS: IntroQuestion[] = [
  {
    id: "type",
    title: "איזו מרפאה זו?",
    subtitle: "שורה קצרה שתופיע מתחת לשם הקליניקה בראש התפריט.",
  },
  {
    id: "groups",
    title: "במי מטפלים בעיקר?",
    subtitle: "אפשר לבחור כמה. לפי הבחירה יוצעו קודם שמות המשימות שמתאימים.",
  },
  {
    id: "hours",
    title: "ימי ושעות העבודה",
    subtitle: "ביומן, הזמן שמחוץ להם יופיע באפור. אפשר לקבוע פגישות גם בו.",
  },
  {
    id: "session",
    title: "פגישה רגילה",
    subtitle: "המשך והמחיר שפגישה חדשה נפתחת איתם. אפשר לשנות בכל פגישה.",
  },
  {
    id: "focus",
    title: "מה הכי חשוב לראות ראשון?",
    subtitle: "מסך הבית יסודר לפי הבחירה.",
  },
  {
    id: "color",
    title: "צבע הממשק",
    subtitle: "הצבע של הכפתורים, הקישורים וההדגשות בכל האפליקציה. אפשר להחליף בכל רגע.",
  },
];

export function isIntroQuestionId(v: unknown): v is IntroQuestionId {
  return INTRO_QUESTIONS.some((q) => q.id === v);
}

/** Where one answer is edited from "המרפאה שלי". */
export function introHref(q?: IntroQuestionId): string {
  return q ? `${INTRO_PATH}?q=${q}` : INTRO_PATH;
}

// ── 1. the kind of clinic ───────────────────────────────────

export const CLINIC_TYPE_MAX = 60;

/** Starting points only: the line is free text. */
export const CLINIC_TYPE_OPTIONS = [
  "פסיכולוגיה קלינית",
  "פסיכולוגיה חינוכית",
  "פסיכותרפיה",
  "טיפול זוגי ומשפחתי",
  "טיפול רגשי בילדים ובנוער",
  "טיפול באמנויות",
  "הדרכת הורים",
] as const;

/** The stored line: trimmed, single spaces, null when empty. */
export function cleanClinicType(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, CLINIC_TYPE_MAX) : null;
}

// ── 2. who is mostly treated ────────────────────────────────

export const CLIENT_GROUPS = [
  { id: "CHILDREN", label: "ילדים" },
  { id: "TEENS", label: "נוער" },
  { id: "ADULTS", label: "מבוגרים" },
  { id: "COUPLES", label: "זוגות" },
  { id: "FAMILIES", label: "משפחות" },
] as const;

export type ClientGroup = (typeof CLIENT_GROUPS)[number]["id"];

/** Known groups only, each once, in the list's own order. */
export function cleanClientGroups(v: unknown): ClientGroup[] {
  const given = Array.isArray(v) ? v : [];
  return CLIENT_GROUPS.map((g) => g.id).filter((id) => given.includes(id));
}

export function clientGroupsText(groups: ClientGroup[]): string | null {
  const labels = CLIENT_GROUPS.filter((g) => groups.includes(g.id)).map((g) => g.label);
  return labels.length ? labels.join(", ") : null;
}

// ── 3. working days and hours ───────────────────────────────

/** One working day: 0 = Sunday … 6 = Saturday, times as "HH:mm" on the clinic's clock. */
export type WorkingDay = { day: number; from: string; to: string };

export const WEEK_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;
const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;

export const DEFAULT_DAY_FROM = "08:00";
export const DEFAULT_DAY_TO = "20:00";

/** Half hours from 05:00 to midnight, for the two selects of a day. */
export const HOUR_CHOICES: string[] = Array.from({ length: (24 - 5) * 2 + 1 }, (_, i) => {
  const minutes = 5 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

const TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

const toMinutes = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function validDay(v: unknown): v is WorkingDay {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    Number.isInteger(d.day) &&
    (d.day as number) >= 0 &&
    (d.day as number) <= 6 &&
    typeof d.from === "string" &&
    typeof d.to === "string" &&
    TIME.test(d.from) &&
    TIME.test(d.to) &&
    toMinutes(d.from) < toMinutes(d.to)
  );
}

/**
 * The stored value read back, whatever is in the column: valid days only, one
 * entry per day, Sunday first. Never throws — a broken value reads as "not
 * answered", and the calendar then greys nothing.
 */
export function parseWorkingHours(v: unknown): WorkingDay[] {
  if (!Array.isArray(v)) return [];
  const byDay = new Map<number, WorkingDay>();
  for (const d of v) {
    if (validDay(d) && !byDay.has(d.day)) byDay.set(d.day, { day: d.day, from: d.from, to: d.to });
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** What is wrong with a form's working hours, or null when they can be saved. */
export function workingHoursError(v: unknown): string | null {
  if (!Array.isArray(v) || v.length > 7) return "ימי העבודה לא תקינים";
  if (v.some((d) => !validDay(d))) return "שעת הסיום צריכה להיות אחרי שעת ההתחלה";
  if (new Set(v.map((d) => (d as WorkingDay).day)).size !== v.length) return "ימי העבודה לא תקינים";
  return null;
}

export type BusinessHours = { daysOfWeek: number[]; startTime: string; endTime: string };

/**
 * FullCalendar's `businessHours`: everything outside is greyed and stays
 * bookable (no selectConstraint / eventConstraint is set). undefined when the
 * question was not answered, so nothing is greyed.
 */
export function businessHoursFor(hours: WorkingDay[]): BusinessHours[] | undefined {
  if (hours.length === 0) return undefined;
  return hours.map((d) => ({ daysOfWeek: [d.day], startTime: d.from, endTime: d.to }));
}

/** The earliest start and latest end of the working week, as minutes of the day. */
export function workingSpan(hours: WorkingDay[]): { start: number; end: number } | null {
  if (hours.length === 0) return null;
  return {
    start: Math.min(...hours.map((d) => toMinutes(d.from))),
    end: Math.max(...hours.map((d) => toMinutes(d.to))),
  };
}

/**
 * "א׳–ה׳ 09:00–19:00 · ו׳ 08:00–13:00": days in a row that share their hours
 * are written as one range. null when nothing was chosen.
 */
export function workingHoursText(hours: WorkingDay[]): string | null {
  if (hours.length === 0) return null;
  const runs: { first: number; last: number; from: string; to: string }[] = [];
  for (const d of hours) {
    const prev = runs[runs.length - 1];
    if (prev && prev.last === d.day - 1 && prev.from === d.from && prev.to === d.to) prev.last = d.day;
    else runs.push({ first: d.day, last: d.day, from: d.from, to: d.to });
  }
  return runs
    .map((r) => {
      const days =
        r.first === r.last
          ? DAY_LETTERS[r.first]
          : r.last === r.first + 1
            ? `${DAY_LETTERS[r.first]}, ${DAY_LETTERS[r.last]}`
            : `${DAY_LETTERS[r.first]}–${DAY_LETTERS[r.last]}`;
      return `${days} ${r.from}–${r.to}`;
    })
    .join(" · ");
}

/** Ticking a day in the form: it starts with the hours of the nearest day already chosen. */
export function addWorkingDay(hours: WorkingDay[], day: number): WorkingDay[] {
  if (hours.some((d) => d.day === day)) return hours;
  const nearest = [...hours].sort((a, b) => Math.abs(a.day - day) - Math.abs(b.day - day))[0];
  const added = { day, from: nearest?.from ?? DEFAULT_DAY_FROM, to: nearest?.to ?? DEFAULT_DAY_TO };
  return [...hours, added].sort((a, b) => a.day - b.day);
}

// ── 5. what matters most ────────────────────────────────────

export const FOCUS_OPTIONS = [
  { id: "CALENDAR", label: "היומן והפגישות", hint: "הפגישות של היום יופיעו ראשונות במסך הבית." },
  { id: "PAYMENTS", label: "התשלומים וההכנסות", hint: "ההכנסות, החוב הפתוח ואישורי התשלום יופיעו ראשונים." },
  { id: "NOTES", label: "תיעוד הפגישות", hint: "הקיצור לתיעוד הפגישות יופיע ראשון." },
] as const;

export type DashboardFocus = (typeof FOCUS_OPTIONS)[number]["id"];

export function cleanFocus(v: unknown): DashboardFocus | null {
  return FOCUS_OPTIONS.find((f) => f.id === v)?.id ?? null;
}

export type DashboardBlock = "stats" | "tiles" | "today";
export type DashboardStat = "clients" | "expected" | "income" | "debt" | "meetings";
export type DashboardTile = "document" | "collect";

export type DashboardLayout = {
  /** the three blocks under the greeting, top to bottom */
  blocks: DashboardBlock[];
  /** the five numbers, first to last */
  stats: DashboardStat[];
  /** the two shortcut tiles */
  tiles: DashboardTile[];
};

const DEFAULT_LAYOUT: DashboardLayout = {
  blocks: ["stats", "tiles", "today"],
  stats: ["clients", "expected", "income", "debt", "meetings"],
  tiles: ["document", "collect"],
};

/**
 * The order of the dashboard's boxes. Nothing is ever removed: the same blocks,
 * numbers and tiles in a different order, and the order of today (before the
 * questionnaire) when the question was not answered.
 */
export function dashboardLayout(focus: unknown): DashboardLayout {
  switch (cleanFocus(focus)) {
    case "CALENDAR":
      return {
        blocks: ["today", "stats", "tiles"],
        stats: ["meetings", "clients", "expected", "income", "debt"],
        tiles: DEFAULT_LAYOUT.tiles,
      };
    case "PAYMENTS":
      return {
        blocks: ["stats", "tiles", "today"],
        stats: ["income", "debt", "expected", "meetings", "clients"],
        tiles: ["collect", "document"],
      };
    case "NOTES":
      return { blocks: ["tiles", "today", "stats"], stats: DEFAULT_LAYOUT.stats, tiles: DEFAULT_LAYOUT.tiles };
    default:
      return DEFAULT_LAYOUT;
  }
}

// ── the answers together ────────────────────────────────────

/** The columns the questionnaire reads (Decimal already turned into a string). */
export type IntroFields = {
  clinicType: string | null;
  clientGroups: unknown;
  workingHours: unknown;
  dashboardFocus: string | null;
  colorTheme?: string | null;
  defaultSessionMinutes: number;
  defaultRate: string | null;
};

export type IntroAnswers = {
  clinicType: string | null;
  clientGroups: ClientGroup[];
  workingHours: WorkingDay[];
  dashboardFocus: DashboardFocus | null;
  /** always a set: the default one when none was chosen */
  colorTheme: ColorThemeId;
  defaultSessionMinutes: number;
  /** a plain number as text, or null */
  defaultRate: string | null;
};

export function introAnswers(user: IntroFields): IntroAnswers {
  return {
    clinicType: cleanClinicType(user.clinicType),
    clientGroups: cleanClientGroups(user.clientGroups),
    workingHours: parseWorkingHours(user.workingHours),
    dashboardFocus: cleanFocus(user.dashboardFocus),
    colorTheme: cleanColorTheme(user.colorTheme) ?? DEFAULT_THEME_ID,
    defaultSessionMinutes: user.defaultSessionMinutes,
    defaultRate: user.defaultRate === "" ? null : user.defaultRate,
  };
}

export type IntroRow = { id: IntroQuestionId; label: string; value: string | null };

/** The answers as the rows of the card on "המרפאה שלי" (null = not answered). */
export function introRows(a: IntroAnswers, formatRate: (rate: string) => string): IntroRow[] {
  const session = [`${a.defaultSessionMinutes} דקות`, ...(a.defaultRate ? [formatRate(a.defaultRate)] : [])];
  return [
    { id: "type", label: "סוג המרפאה", value: a.clinicType },
    { id: "groups", label: "במי מטפלים בעיקר", value: clientGroupsText(a.clientGroups) },
    { id: "hours", label: "ימי ושעות העבודה", value: workingHoursText(a.workingHours) },
    { id: "session", label: "פגישה רגילה", value: session.join(" · ") },
    { id: "focus", label: "הכי חשוב לראות ראשון", value: FOCUS_OPTIONS.find((f) => f.id === a.dashboardFocus)?.label ?? null },
    // Never "not answered": an account that chose nothing is in the default set
    { id: "color", label: "צבע הממשק", value: colorTheme(a.colorTheme).label },
  ];
}
