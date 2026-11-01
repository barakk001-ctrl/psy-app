// The first-run setup wizard (/setup): the steps and who goes through it. Pure,
// tested in onboarding.test.ts. Every step reuses a Settings card; a step saves
// when "הבא" is pressed, so leaving halfway loses nothing.

export type SetupStepId = "brand" | "business" | "types" | "morning" | "done";

export type SetupStep = { id: SetupStepId; title: string; subtitle: string };

export const SETUP_STEPS: SetupStep[] = [
  { id: "brand", title: "איך נקרא לקליניקה?", subtitle: "שם ותמונה או לוגו שיופיעו בראש האפליקציה." },
  { id: "business", title: "פרטי העסק", subtitle: "מופיעים בראש המסמכים שמפיקים. אפשר למלא גם תעריף רגיל." },
  { id: "types", title: "סוגי מפגשים ויומן", subtitle: "משך פגישה רגיל, סוגי המפגשים והצבע של כל סוג ביומן." },
  { id: "morning", title: "חיבור ל-morning", subtitle: "לא חובה, ואפשר לחבר אחר כך בהגדרות." },
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
