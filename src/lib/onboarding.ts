// The first-run setup wizard (/setup): the steps and who goes through it. Pure,
// tested in onboarding.test.ts. Every step reuses a Settings card; a step saves
// when "הבא" is pressed, so leaving halfway loses nothing. The last three
// before "done" are the שאלון היכרות (src/lib/intro.ts): its usual meeting
// length and price are already asked in the steps before them.

import { INTRO_QUESTIONS, type IntroQuestionId } from "@/lib/intro";

export type SetupStepId = "brand" | "business" | "types" | "about" | "hours" | "focus" | "done";

export type SetupStep = { id: SetupStepId; title: string; subtitle: string };

const question = (id: IntroQuestionId) => {
  const { title, subtitle } = INTRO_QUESTIONS.find((q) => q.id === id)!;
  return { title, subtitle };
};

/** The questionnaire's questions on each of its steps. New steps go before
 *  "done" and after these, so a step saved mid-way keeps meaning the same. */
export const INTRO_STEPS: Partial<Record<SetupStepId, IntroQuestionId[]>> = {
  about: ["type", "groups", "word"],
  hours: ["hours"],
  focus: ["focus", "color"],
};

export const SETUP_STEPS: SetupStep[] = [
  { id: "brand", title: "איך נקרא לקליניקה?", subtitle: "שם ותמונה או לוגו שיופיעו בראש האפליקציה." },
  { id: "business", title: "פרטי העסק", subtitle: "מופיעים בראש המסמכים שמפיקים. אפשר למלא גם תעריף רגיל." },
  { id: "types", title: "סוגי מפגשים ויומן", subtitle: "משך פגישה רגיל, סוגי המפגשים והצבע של כל סוג ביומן." },
  {
    id: "about",
    title: "קצת על המרפאה",
    subtitle: "שאלון היכרות קצר, על המרפאה עצמה ולא על לקוחות. האפליקציה מתאימה את עצמה לתשובות, ואפשר לדלג על כל שאלה.",
  },
  { id: "hours", ...question("hours") },
  {
    id: "focus",
    title: "התאמה אישית",
    subtitle: "מה יופיע ראשון במסך הבית, ובאיזה צבע תהיה האפליקציה.",
  },
  { id: "done", title: "הכול מוכן", subtitle: "אפשר להתחיל לעבוד. כל מה שמילאתם נשמר, ואפשר לשנות אותו בהגדרות." },
];

export const LAST_STEP = SETUP_STEPS.length - 1;
/** Steps with something to fill — what the progress line counts. */
export const FORM_STEPS = LAST_STEP;

export function clampStep(n: number): number {
  if (!Number.isInteger(n)) return 0;
  return Math.min(Math.max(n, 0), LAST_STEP);
}

/** Which step to open: the one in the URL (1-based), else where they stopped. */
export function stepToOpen(param: string | undefined, savedStep: number): number {
  const fromUrl = param !== undefined && /^\d+$/.test(param) ? Number(param) - 1 : null;
  return clampStep(fromUrl ?? savedStep);
}

export type OnboardingFields = {
  onboardingCompletedAt: Date | null;
  onboardingPausedAt: Date | null;
};

/**
 * Whether the app sends this account into the wizard. New accounts only:
 * finished or paused ones never, and neither do expired ones — they are
 * read-only, and the wizard's saves would all be refused.
 */
export function shouldEnterSetup(user: OnboardingFields, status: string): boolean {
  if (user.onboardingCompletedAt || user.onboardingPausedAt) return false;
  return status !== "expired";
}
