import crypto from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildResetEmail } from "@/lib/reset-email";

/**
 * Issues a one-hour, single-use link to /reset-password/<token> and emails it.
 * Used by "שכחת סיסמה?" and by Settings for an account opened through Google
 * that wants a password too (the same link sets a first password).
 */
export async function sendPasswordResetLink(user: {
  id: string;
  name: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken: tokenHash,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const h = await headers();
  const origin =
    process.env.NEXTAUTH_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { subject, html, text } = buildResetEmail({
    name: user.name,
    resetUrl: `${origin}/reset-password/${token}`,
  });
  const result = await sendEmail({ to: user.email, subject, html, text });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
