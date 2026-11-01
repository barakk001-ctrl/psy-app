"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createLoginCode } from "@/lib/login-code-store";
import { rateLimit } from "@/lib/rate-limit";
import { REAUTH_CODE_SEND_LIMIT, reauthMethod } from "@/lib/reauth";
import { buildReauthCodeEmail } from "@/lib/reauth-email";
import { verifyReauth } from "@/lib/reauth-server";
import { EXPORT_RATE_LIMIT, createExportGrant } from "@/lib/account-export";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export type ReauthCodeResult = { sent: true } | { error: string };

/** An account with neither password nor authenticator confirms by a code to its email. */
export async function sendReauthCodeAction(): Promise<ReauthCodeResult> {
  const userId = await requireUserId();
  const limit = await rateLimit(`reauth-code:${userId}`, REAUTH_CODE_SEND_LIMIT);
  if (!limit.allowed) return { error: "נשלחו כמה קודים ברצף — נסו שוב בעוד רבע שעה" };

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, hashedPassword: true, totpEnabled: true, totpSecret: true },
  });
  if (!me) return { error: "החשבון לא נמצא" };
  if (reauthMethod(me) !== "email") return { error: "אפשר לאשר בסיסמה או בקוד מאפליקציית האימות" };

  const code = await createLoginCode(userId);
  const result = await sendEmail({ to: me.email, ...buildReauthCodeEmail({ name: me.name, code }) });
  if (!result.ok) return { error: "שליחת הקוד נכשלה — נסו שוב מאוחר יותר" };
  return { sent: true };
}

export type ExportPrepareResult = { grant: string } | { error: string };

/**
 * Settings → "הורדת כל הנתונים": checks the password or code and leaves a
 * one-time grant the download spends (/api/account/export). Open to expired
 * accounts: their data stays theirs to take.
 */
export async function prepareAccountExportAction(formData: FormData): Promise<ExportPrepareResult> {
  const userId = await requireUserId();
  const check = await verifyReauth(userId, String(formData.get("reauth") ?? ""));
  if (!check.ok) return { error: check.error };

  const limit = await rateLimit(`account-export:${userId}`, EXPORT_RATE_LIMIT);
  if (!limit.allowed) return { error: "אפשר להוריד עד 3 פעמים בשעה — נסו שוב מאוחר יותר" };

  return { grant: await createExportGrant(userId) };
}
