import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { consumeLoginCode } from "@/lib/login-code-store";
import { rateLimit } from "@/lib/rate-limit";
import { REAUTH_LIMIT, reauthMethod } from "@/lib/reauth";
import { verifySecondFactor } from "@/lib/second-factor";

export type ReauthResult = { ok: true } | { ok: false; error: string };

/**
 * Checks what was typed against the account's re-check method (reauth.ts).
 * Email codes are the one-time sign-in codes (login-code-store.ts): one live
 * code per account, single use, 10 minutes, 5 wrong tries.
 */
export async function verifyReauth(userId: string, input: string): Promise<ReauthResult> {
  const limit = await rateLimit(`reauth:${userId}`, REAUTH_LIMIT);
  if (!limit.allowed) return { ok: false, error: "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hashedPassword: true,
      totpEnabled: true,
      totpSecret: true,
      totpBackupCodes: true,
    },
  });
  if (!user) return { ok: false, error: "החשבון לא נמצא" };

  const typed = input.trim();
  if (!typed) return { ok: false, error: "נא למלא את פרטי האימות" };

  const method = reauthMethod(user);
  let ok = false;
  if (method === "totp") ok = await verifySecondFactor(user, typed);
  else if (method === "password") ok = await bcrypt.compare(input, user.hashedPassword!);
  else ok = await consumeLoginCode(userId, typed);

  if (ok) return { ok: true };
  return {
    ok: false,
    error: method === "password" ? "הסיסמה שגויה" : "הקוד שגוי או שפג תוקפו",
  };
}
