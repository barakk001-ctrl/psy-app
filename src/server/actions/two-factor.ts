"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/totp";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type TotpEnrollState = {
  error?: string;
  qrDataUrl?: string;
  manualKey?: string;
  enabled?: boolean;
  disabled?: boolean;
  /** Shown exactly once — not retrievable later */
  backupCodes?: string[];
} | null;

/** Step 1: create a pending secret and return the QR to scan. */
export async function startTotpEnrollmentAction(
  _: TotpEnrollState,
  __: FormData,
): Promise<TotpEnrollState> {
  const userId = await requireUserId();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) return { error: "משתמש לא נמצא" };
  if (user.totpEnabled) return { error: "אימות דו-שלבי כבר פעיל" };

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret), totpEnabled: false },
  });

  const uri = buildOtpAuthUri(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  return { qrDataUrl, manualKey: secret };
}

/** Step 2: verify the first code — only then 2FA becomes active. */
export async function confirmTotpEnrollmentAction(
  _: TotpEnrollState,
  formData: FormData,
): Promise<TotpEnrollState> {
  const userId = await requireUserId();
  const code = String(formData.get("code") ?? "");

  const limited = rateLimit(`totp:${userId}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!limited.allowed) return { error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });
  if (!user?.totpSecret) return { error: "יש להתחיל את ההגדרה מחדש" };

  try {
    const secret = decryptSecret(user.totpSecret);
    if (!verifyTotp(secret, code)) {
      return { error: "הקוד שגוי — נסו שוב" };
    }
  } catch {
    return { error: "יש להתחיל את ההגדרה מחדש" };
  }

  const backup = generateBackupCodes(5);
  await db.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpBackupCodes: JSON.stringify(backup.hashes) },
  });
  revalidatePath("/settings");
  return { enabled: true, backupCodes: backup.codes };
}

/** Issues a fresh set of one-time backup codes (invalidates the old ones). */
export async function regenerateBackupCodesAction(
  _: TotpEnrollState,
  formData: FormData,
): Promise<TotpEnrollState> {
  const userId = await requireUserId();
  const code = String(formData.get("code") ?? "");

  const limited = rateLimit(`totp:${userId}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!limited.allowed) return { error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "אימות דו-שלבי אינו פעיל" };

  try {
    const secret = decryptSecret(user.totpSecret);
    if (!verifyTotp(secret, code)) return { error: "הקוד שגוי — נסו שוב" };
  } catch {
    return { error: "שגיאה ביצירת הקודים" };
  }

  const backup = generateBackupCodes(5);
  await db.user.update({
    where: { id: userId },
    data: { totpBackupCodes: JSON.stringify(backup.hashes) },
  });
  revalidatePath("/settings");
  return { backupCodes: backup.codes };
}

/** Turning off requires a valid current code. */
export async function disableTotpAction(
  _: TotpEnrollState,
  formData: FormData,
): Promise<TotpEnrollState> {
  const userId = await requireUserId();
  const code = String(formData.get("code") ?? "");

  const limited = rateLimit(`totp:${userId}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!limited.allowed) return { error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return { error: "אימות דו-שלבי אינו פעיל" };

  try {
    const secret = decryptSecret(user.totpSecret);
    if (!verifyTotp(secret, code)) return { error: "הקוד שגוי — נסו שוב" };
  } catch {
    return { error: "שגיאה בביטול" };
  }

  await db.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: null },
  });
  revalidatePath("/settings");
  return { disabled: true };
}
