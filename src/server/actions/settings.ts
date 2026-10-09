"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { getMorningCredentials, testMorningConnection } from "@/lib/morning";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { changePasswordSchema } from "@/server/validators/auth";
import { sendPasswordResetLink } from "@/lib/password-reset";
import {
  brandingSchema,
  businessInfoSchema,
  idleTimeoutSchema,
  personalDetailsSchema,
  sessionDefaultsSchema,
} from "@/server/validators/settings";

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
    businessName: formData.get("businessName") ?? "",
    businessId: formData.get("businessId") ?? "",
    vatLiable: formData.get("vatLiable") ?? "false",
    address: formData.get("address") ?? "",
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
      businessName: data.businessName || null,
      businessId: data.businessId || null,
      vatLiable: data.vatLiable,
      address: data.address || null,
      defaultRate: data.defaultRate ?? null,
    },
  });

  revalidatePath("/settings");
  return { saved: true };
}

/** Personal details: name, login email and phone. Email changes are limited
 *  to the registration allowlist — otherwise a user could rotate to an
 *  address the operator never approved. */
/** The default meeting length used when a new session form opens. Existing
 *  sessions keep whatever length they were saved with — this only changes what
 *  the next form is pre-filled with. */
export async function updateSessionDefaultsAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = sessionDefaultsSchema.safeParse({
    defaultSessionMinutes: formData.get("defaultSessionMinutes") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await db.user.update({
    where: { id: userId },
    data: { defaultSessionMinutes: parsed.data.defaultSessionMinutes },
  });

  revalidatePath("/settings");
  revalidatePath("/sessions/new");
  return { saved: true };
}

/** Name and logo shown in the app header. The header sits in the (app)
 *  layout, so the whole layout is revalidated. */
export async function updateBrandingAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = brandingSchema.safeParse({
    brandName: formData.get("brandName") ?? "",
    logo: formData.get("logo") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: fieldErrors.logo?.[0] ?? "אנא תקן את השגיאות בטופס", fieldErrors };
  }

  const { brandName, logo } = parsed.data;
  await db.user.update({
    where: { id: userId },
    data: {
      brandName: brandName || null,
      ...(logo === "REMOVE" ? { logoUrl: null } : logo ? { logoUrl: logo } : {}),
    },
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

/** The "מועדי ישראל" checkbox above the calendar. Kept on the account rather
 *  than the device, so the laptop and the phone agree. */
export async function setShowHolidaysAction(show: boolean): Promise<void> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { showHolidays: !!show } });
  revalidatePath("/calendar");
}

export async function updatePersonalDetailsAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = personalDetailsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "אנא תקן את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const email = parsed.data.email.toLowerCase();

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!me) return { error: "משתמש לא נמצא" };

  if (email !== me.email) {
    const allowed = process.env.ALLOWED_EMAILS;
    const inAllowlist = allowed
      ? allowed.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email)
      : process.env.NODE_ENV !== "production";
    if (!inAllowlist) {
      return {
        error: "כתובת האימייל החדשה אינה מאושרת במערכת — פנו למנהל המערכת",
        fieldErrors: { email: ["כתובת לא מאושרת"] },
      };
    }
    const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) {
      return {
        error: "כתובת האימייל כבר בשימוש",
        fieldErrors: { email: ["כתובת תפוסה"] },
      };
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { saved: true };
}

/** Settings → שינוי סיסמה. Needs the current password, so an unlocked device alone can't change it. */
export async function changePasswordAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return { error: "אנא תקנו את השגיאות בטופס", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Guessing the current password from a signed-in session is still guessing
  const limit = rateLimit(`change-password:${userId}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!limit.allowed) {
    return { error: "יותר מדי ניסיונות — נסו שוב בעוד כמה דקות" };
  }

  const me = await db.user.findUnique({ where: { id: userId }, select: { hashedPassword: true } });
  if (!me?.hashedPassword || !(await bcrypt.compare(parsed.data.current, me.hashedPassword))) {
    return { error: "הסיסמה הנוכחית שגויה", fieldErrors: { current: ["הסיסמה הנוכחית שגויה"] } };
  }

  await db.user.update({
    where: { id: userId },
    // a pending "forgot password" link must not outlive the password it was meant to replace
    data: { hashedPassword: await bcrypt.hash(parsed.data.password, 10), resetToken: null, resetTokenExpiry: null },
  });
  await logAudit(userId, "PASSWORD_CHANGE");
  revalidatePath("/settings");
  return { saved: true };
}

export type SetPasswordLinkState = { error?: string; sent?: boolean } | null;

/**
 * Settings, for an account opened through Google (no password yet): emails the
 * usual one-hour "set a password" link to the account's own address. A
 * signed-in session alone can't set a password — proving the mailbox is
 * required, as with "שכחת סיסמה?".
 */
export async function sendSetPasswordLinkAction(
  _: SetPasswordLinkState,
  __: FormData,
): Promise<SetPasswordLinkState> {
  const userId = await requireUserId();
  const limit = rateLimit(`set-password-link:${userId}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!limit.allowed) return { error: "יותר מדי בקשות — נסו שוב מאוחר יותר" };

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, hashedPassword: true },
  });
  if (!me) return { error: "משתמש לא נמצא" };
  if (me.hashedPassword) return { error: "לחשבון כבר יש סיסמה — אפשר לשנות אותה כאן" };

  const result = await sendPasswordResetLink(me);
  if (!result.ok) {
    console.error("Set-password email failed:", result.error);
    return { error: "שליחת האימייל נכשלה — נסו שוב מאוחר יותר" };
  }
  return { sent: true };
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

/**
 * Settings → ניתוק אוטומטי. Saved on the account (the browser timer reads it
 * from the layout) and copied into the current session token, whose clock the
 * server checks on every request — see src/lib/idle-timeout.ts. Other devices
 * pick it up at their next sign-in.
 */
export async function updateIdleTimeoutAction(
  _: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  const parsed = idleTimeoutSchema.safeParse({ minutes: formData.get("minutes") });
  if (!parsed.success) return { error: "יש לבחור אחת מהאפשרויות" };

  await db.user.update({
    where: { id: userId },
    data: { idleTimeoutMinutes: parsed.data.minutes },
  });
  try {
    // The jwt callback takes only a valid `idleMinutes` from an update.
    await unstable_update({ idleMinutes: parsed.data.minutes } as unknown as Parameters<
      typeof unstable_update
    >[0]);
  } catch {
    // the account is saved; the token follows at the next sign-in
  }
  revalidatePath("/", "layout");
  return { saved: true };
}
