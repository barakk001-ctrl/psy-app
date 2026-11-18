"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cleanColorTheme } from "@/lib/color-themes";
import { cleanClientGroups, cleanClinicType, cleanFocus, parseWorkingHours } from "@/lib/intro";
import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly } from "@/lib/subscription-server";
import { introAnswersSchema } from "@/server/validators/intro";

// The שאלון היכרות (rules in src/lib/intro.ts): answers about the practice
// itself, saved on the signed-in user's own row. No client data, so nothing
// here goes to the access log.

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type IntroResult = { ok?: boolean; error?: string };

/**
 * Saves the answers that were sent, and only those: a question that is not in
 * `input` keeps its answer. An empty value clears an answer.
 */
export async function saveIntroAnswersAction(input: unknown): Promise<IntroResult> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = introAnswersSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { error: first && /[\u0590-\u05FF]/.test(first) ? first : "אנא תקנו את השגיאות בטופס" };
  }
  const a = parsed.data;

  const data: Prisma.UserUpdateInput = {};
  if (a.clinicType !== undefined) data.clinicType = cleanClinicType(a.clinicType);
  if (a.clientGroups !== undefined) data.clientGroups = cleanClientGroups(a.clientGroups);
  if (a.workingHours !== undefined) {
    const hours = parseWorkingHours(a.workingHours);
    data.workingHours = hours.length ? hours : Prisma.DbNull;
  }
  if (a.dashboardFocus !== undefined) data.dashboardFocus = cleanFocus(a.dashboardFocus);
  if (a.colorTheme !== undefined) data.colorTheme = cleanColorTheme(a.colorTheme);
  if (a.defaultSessionMinutes !== undefined) data.defaultSessionMinutes = a.defaultSessionMinutes;
  if (a.defaultRate !== undefined) data.defaultRate = a.defaultRate;

  if (Object.keys(data).length > 0) {
    await db.user.update({ where: { id: userId }, data });
    // The line under the clinic's name and the colour set are in the layout;
    // the calendar, the dashboard and the task lists read the rest
    revalidatePath("/", "layout");
  }
  return { ok: true };
}

/** The questionnaire was gone through or put aside: "המרפאה שלי" stops inviting. */
export async function finishIntroAction(): Promise<IntroResult> {
  const userId = await requireUserId();
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  await db.user.updateMany({ where: { id: userId, introDoneAt: null }, data: { introDoneAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}
