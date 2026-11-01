import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { canonicalOrigin, originFromHeaders } from "@/lib/request-origin";
import { hashVerifyToken, issueVerifyToken } from "@/lib/email-verification";
import { buildExistingAccountEmail, buildVerifyEmail } from "@/lib/verify-email-mail";

/** Links in emails go to the main address (APP_URL = https://mirpaa.app). */
async function emailOrigin() {
  return canonicalOrigin() ?? originFromHeaders(await headers());
}

/** A new link for an account waiting for verification; the earlier one stops working. */
export async function sendVerificationLink(user: { id: string; email: string }): Promise<void> {
  const origin = await emailOrigin();
  const { token, hash, expiresAt } = issueVerifyToken(Date.now());
  await db.user.update({
    where: { id: user.id },
    data: { emailVerifyTokenHash: hash, emailVerifyExpiresAt: expiresAt },
  });
  const verifyUrl = `${origin}/verify-email/${token}`;
  const result = await sendEmail({ to: user.email, ...buildVerifyEmail({ verifyUrl }) });
  if (!result.ok) {
    console.error("[verify-email] send failed");
    // No mail provider on a developer's machine: the link is the only way in.
    if (process.env.NODE_ENV !== "production") console.log(`[verify-email] dev link: ${verifyUrl}`);
  }
}

/** Someone signed up with an address that already has an account: tell its owner. */
export async function sendExistingAccountNotice(user: { email: string }): Promise<void> {
  const origin = await emailOrigin();
  const mail = buildExistingAccountEmail({ loginUrl: `${origin}/login`, resetUrl: `${origin}/forgot-password` });
  const result = await sendEmail({ to: user.email, ...mail });
  if (!result.ok) console.error("[verify-email] notice send failed");
}

/** The account a live link belongs to, or null (unknown, expired or already used). */
export async function findUserByVerifyToken(token: string) {
  return db.user.findFirst({
    where: {
      emailVerifyTokenHash: hashVerifyToken(token),
      emailVerifyExpiresAt: { gt: new Date() },
      emailVerifiedAt: null,
    },
    select: { id: true, email: true, hashedPassword: true },
  });
}

/** Marks the address verified. Conditional on the token, so a link works once even under a race. */
export async function consumeVerifyToken(userId: string, token: string): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: {
      id: userId,
      emailVerifyTokenHash: hashVerifyToken(token),
      emailVerifyExpiresAt: { gt: new Date() },
    },
    data: { emailVerifiedAt: new Date(), emailVerifyTokenHash: null, emailVerifyExpiresAt: null },
  });
  return count === 1;
}
