"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { getMorningCredentials, testMorningConnection } from "@/lib/morning";
import { businessInfoSchema } from "@/server/validators/settings";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  saved?: boolean;
} | null;

/** Enables (or rotates) the private ICS calendar-feed token. */
export async function calendarFeedEnableAction() {
  const userId = await requireUserId();
  const { randomBytes } = await import("node:crypto");
  await db.user.update({
    where: { id: userId },
    data: { calendarToken: randomBytes(24).toString("base64url") },
  });
  revalidatePath("/settings");
}

/** Disables the calendar feed — the old URL stops working immediately. */
export async function calendarFeedDisableAction() {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { calendarToken: null } });
  revalidatePath("/settings");
}

const CALENDAR_NAME_MODES = ["FIRST", "FULL", "NONE"] as const;

export async function calendarFeedModeAction(formData: FormData) {
  const userId = await requireUserId();
  const mode = String(formData.get("mode") ?? "");
  if (!(CALENDAR_NAME_MODES as readonly string[]).includes(mode)) return;
  await db.user.update({ where: { id: userId }, data: { calendarNameMode: mode } });
  revalidatePath("/settings");
}

/** Records click-acceptance of the current data-holding agreement version. */
export async function acceptAgreementAction() {
  const userId = await requireUserId();
  await db.user.update({
    where: { id: userId },
    data: { agreementVersion: AGREEMENT_VERSION, agreementAcceptedAt: new Date() },
  });
  revalidatePath("/dashboard");
}

export async function updateBusinessInfoAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = businessInfoSchema.safeParse({
    name: formData.get("name"),
    businessName: formData.get("businessName") ?? "",
    businessId: formData.get("businessId") ?? "",
    vatLiable: formData.get("vatLiable") ?? "false",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    defaultRate: formData.get("defaultRate") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      businessName: data.businessName || null,
      businessId: data.businessId || null,
      vatLiable: data.vatLiable,
      address: data.address || null,
      phone: data.phone || null,
      defaultRate: data.defaultRate ?? null,
    },
  });

  revalidatePath("/settings");
  return { saved: true };
}

export type MorningSettingsState = {
  error?: string;
  saved?: boolean;
  connectionOk?: boolean;
} | null;

export async function saveMorningSettingsAction(
  _: MorningSettingsState,
  formData: FormData,
): Promise<MorningSettingsState> {
  const userId = await requireUserId();

  const keyId = String(formData.get("morningApiKeyId") ?? "").trim();
  const secret = String(formData.get("morningApiSecret") ?? "").trim();
  const sandbox = formData.get("morningSandbox") === "on";
  const docTypeRaw = Number(formData.get("morningDocType") ?? 400);
  const docType = docTypeRaw === 320 ? 320 : 400;

  // No new keys entered — update preferences on the existing connection
  if (!keyId && !secret) {
    const existing = await getMorningCredentials(userId);
    if (!existing) {
      return { error: "יש להזין גם מזהה מפתח (ID) וגם מפתח סודי (Secret)" };
    }
    if (existing.sandbox !== sandbox) {
      // Environment changed — the stored keys must be valid there
      const retest = await testMorningConnection(userId, { ...existing, sandbox });
      if (!retest.ok) {
        return {
          error: `המפתחות השמורים לא תקפים בסביבה שנבחרה — יש להזין מפתחות מתאימים. (${retest.error})`,
        };
      }
    }
    await db.user.update({
      where: { id: userId },
      data: { morningSandbox: sandbox, morningDocType: docType },
    });
    revalidatePath("/settings");
    return { saved: true, connectionOk: true };
  }

  if (!keyId || !secret) {
    return { error: "יש להזין גם מזהה מפתח (ID) וגם מפתח סודי (Secret)" };
  }

  // Verify the credentials against Morning before saving
  const test = await testMorningConnection(userId, { keyId, secret, sandbox });
  if (!test.ok) {
    const envHint = test.error.includes("401")
      ? sandbox
        ? " שימו לב: מפתחות מהחשבון האמיתי לא עובדים מול Sandbox — בטלו את הסימון של סביבת הניסיון ונסו שוב."
        : " שימו לב: מפתחות של חשבון Sandbox עובדים רק כשסביבת הניסיון מסומנת."
      : "";
    return {
      error: `החיבור ל-morning נכשל — בדקו את המפתחות. (${test.error})${envHint}`,
    };
  }

  await db.user.update({
    where: { id: userId },
    data: {
      morningApiKeyId: keyId,
      morningApiSecret: encryptSecret(secret),
      morningSandbox: sandbox,
      morningDocType: docType,
    },
  });

  revalidatePath("/settings");
  return { saved: true, connectionOk: true };
}

export async function disconnectMorningAction() {
  const userId = await requireUserId();
  await db.user.update({
    where: { id: userId },
    data: { morningApiKeyId: null, morningApiSecret: null, morningSandbox: true },
  });
  revalidatePath("/settings");
}
