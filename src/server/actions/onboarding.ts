"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { LAST_STEP, clampStep } from "@/lib/onboarding";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly } from "@/lib/subscription-server";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type OnboardingResult = { ok: boolean; error?: string };

/** Remembers the step reached, and finishes the wizard on the last one. A
 *  finished account reopening it from Settings changes nothing here. */
export async function setOnboardingStepAction(step: number): Promise<OnboardingResult> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { ok: false, error: READ_ONLY_ERROR };
  const next = clampStep(step);
  await db.user.updateMany({
    where: { id: userId, onboardingCompletedAt: null },
    data: next === LAST_STEP ? { onboardingStep: next, onboardingCompletedAt: new Date() } : { onboardingStep: next },
  });
  return { ok: true };
}

/** "לסיים מאוחר יותר": no more redirects; the dashboard offers to continue. */
export async function pauseOnboardingAction(): Promise<OnboardingResult> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { ok: false, error: READ_ONLY_ERROR };
  await db.user.updateMany({
    where: { id: userId, onboardingCompletedAt: null },
    data: { onboardingPausedAt: new Date() },
  });
  return { ok: true };
}
