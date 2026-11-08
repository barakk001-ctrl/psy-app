"use server";

import { documentsEnabled, DOCUMENTS_OFF_ERROR } from "@/lib/features";

import { READ_ONLY_ERROR } from "@/lib/subscription";
import { isReadOnly, requireWritable } from "@/lib/subscription-server";
import { creatableKinds, documentDefaults } from "@/lib/billing-docs";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  EMAIL_BODY_MAX,
  EMAIL_SUBJECT_MAX,
  NEXT_NUMBER_FIELDS,
  isDocColor,
  isDocTemplate,
  isValidSignatureDataUrl,
  parseNextNumber,
  storedEmailText,
} from "@/lib/document-look";
import { canCreateAccount } from "@/lib/signup-policy";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
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
  await requireWritable(userId);
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
  await requireWritable(userId);
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
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  // The setup wizard's shorter form sends only some fields: absent ones stay as they are
  const OPTIONAL_FIELDS = [
    "occupation",
    "businessDescription",
    "phone",
    "docEmail",
    "website",
    "businessNameEn",
    "addressEn",
    "descriptionEn",
  ] as const;
  const sent = OPTIONAL_FIELDS.filter((f) => formData.has(f));
  const parsed = businessInfoSchema.safeParse({
    businessName: formData.get("businessName") ?? "",
    businessId: formData.get("businessId") ?? "",
    vatLiable: formData.get("vatLiable") ?? "false",
    address: formData.get("address") ?? "",
    defaultRate: formData.get("defaultRate") ?? "",
    ...Object.fromEntries(sent.map((f) => [f, formData.get(f) ?? ""])),
  });

  if (!parsed.success) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
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
      ...Object.fromEntries(sent.map((f) => [f, data[f] || null])),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/invoices", "layout");
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
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = sessionDefaultsSchema.safeParse({
    defaultSessionMinutes: formData.get("defaultSessionMinutes") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
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
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = brandingSchema.safeParse({
    brandName: formData.get("brandName") ?? "",
    logo: formData.get("logo") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: fieldErrors.logo?.[0] ?? "אנא תקנו את השגיאות בטופס", fieldErrors };
  }

  const { brandName, logo } = parsed.data;
  await db.user.update({
    where: { id: userId },
    data: {
      brandName: brandName || null,
      logoOnDocuments: formData.get("logoOnDocuments") === "on",
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
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };

  const parsed = personalDetailsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
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
    // The same rule as opening a new account (signup-policy.ts)
    if (!canCreateAccount(email)) {
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
      // The phone moved to Settings → הגדרות עסק; an older form may still send it
      ...(formData.has("phone") ? { phone: parsed.data.phone || null } : {}),
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
  const limit = await rateLimit(`change-password:${userId}`, { limit: 5, windowMs: 15 * 60_000 });
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
  const limit = await rateLimit(`set-password-link:${userId}`, { limit: 3, windowMs: 60 * 60_000 });
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

/** Settings → ברירות מחדל למסמכים: where each new document's settings bar starts. */
export async function updateDocumentDefaultsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const owner = await db.user.findUnique({ where: { id: userId }, select: { vatLiable: true } });
  const d = documentDefaults({
    docCurrency: String(formData.get("docCurrency") ?? ""),
    docLang: String(formData.get("docLang") ?? ""),
    docVatType: Number(formData.get("docVatType") ?? 0),
    docRounding: formData.get("docRounding") === "on",
    vatLiable: owner?.vatLiable,
  });
  // The type "מסמך חדש" starts on: 400 קבלה, 320 חשבונית מס/קבלה, 305 חשבונית מס.
  // Sent only to a VAT-liable business (an exempt one issues receipts only).
  const rawType = formData.get("defaultDocType");
  const typeCode = Number(rawType);
  const defaultDocType =
    rawType === null ? undefined : typeCode === 320 || typeCode === 305 ? typeCode : 400;
  await db.user.update({
    where: { id: userId },
    data: {
      docCurrency: d.currency,
      docLang: d.lang,
      docVatType: d.vatType,
      docRounding: d.rounding,
      ...(defaultDocType !== undefined ? { defaultDocType } : {}),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/invoices/new");
  return { saved: true };
}

/**
 * Settings → הגדרות מסמכים → "מראה המסמך": template, color and the signature
 * image. `signature` is "" to keep the stored one, "REMOVE" to clear it, or a
 * new PNG/JPEG data: URL (checked here, like the logo).
 */
export async function updateDocumentLookAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const template = String(formData.get("docTemplate") ?? "");
  const color = String(formData.get("docColor") ?? "");
  const signature = String(formData.get("signature") ?? "");
  if (!isDocTemplate(template) || !isDocColor(color)) return { error: "יש לבחור תבנית וצבע מהרשימה" };
  if (signature && signature !== "REMOVE" && !isValidSignatureDataUrl(signature)) {
    return { error: "קובץ החתימה לא תקין או גדול מדי — נסו תמונת PNG או JPG", fieldErrors: { signature: ["קובץ לא תקין"] } };
  }
  await db.user.update({
    where: { id: userId },
    data: {
      docTemplate: template,
      docColor: color,
      ...(signature === "REMOVE" ? { signatureUrl: null } : signature ? { signatureUrl: signature } : {}),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/invoices", "layout");
  return { saved: true };
}

/** Settings → הגדרות מסמכים → "מייל ללקוח": the subject and message sent with a document (once issuing exists). */
export async function updateDocumentEmailAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const subject = String(formData.get("docEmailSubject") ?? "");
  const body = String(formData.get("docEmailBody") ?? "");
  if (subject.trim().length > EMAIL_SUBJECT_MAX) {
    return { error: `הנושא ארוך מדי (עד ${EMAIL_SUBJECT_MAX} תווים)`, fieldErrors: { docEmailSubject: ["ארוך מדי"] } };
  }
  if (body.trim().length > EMAIL_BODY_MAX) {
    return { error: `ההודעה ארוכה מדי (עד ${EMAIL_BODY_MAX} תווים)`, fieldErrors: { docEmailBody: ["ארוכה מדי"] } };
  }
  await db.user.update({
    where: { id: userId },
    data: {
      docEmailSubject: storedEmailText(subject, DEFAULT_EMAIL_SUBJECT),
      docEmailBody: storedEmailText(body, DEFAULT_EMAIL_BODY),
    },
  });
  revalidatePath("/settings");
  return { saved: true };
}

/**
 * Settings → הגדרות מסמכים → "מספור מסמכים": the number the next document of
 * each type will get once the app issues documents. Whole numbers from 1. No
 * document is issued from the app yet, so nothing can be passed; when issuing
 * exists, a number must never go below one already used.
 */
export async function updateDocumentNumberingAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const userId = await requireUserId();
  // Hidden until documents can be issued (src/lib/features.ts)
  if (!documentsEnabled()) return { error: DOCUMENTS_OFF_ERROR };
  if (await isReadOnly(userId)) return { error: READ_ONLY_ERROR };
  const owner = await db.user.findUnique({ where: { id: userId }, select: { vatLiable: true } });
  const data: Partial<Record<(typeof NEXT_NUMBER_FIELDS)[keyof typeof NEXT_NUMBER_FIELDS], number>> = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const k of creatableKinds(!!owner?.vatLiable)) {
    const field = NEXT_NUMBER_FIELDS[k.kind];
    if (!formData.has(field)) continue;
    const n = parseNextNumber(String(formData.get(field) ?? ""));
    if (n === null) fieldErrors[field] = ["מספר שלם וחיובי (1 ומעלה)"];
    else data[field] = n;
  }
  if (Object.keys(fieldErrors).length) {
    return { error: "המספר של המסמך הבא צריך להיות מספר שלם וחיובי", fieldErrors };
  }
  await db.user.update({ where: { id: userId }, data });
  revalidatePath("/settings");
  return { saved: true };
}
