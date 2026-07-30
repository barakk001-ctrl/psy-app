"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { buildResetEmail } from "@/lib/reset-email";
import { signIn, signOut } from "@/auth";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/server/validators/auth";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function registrationAllowed(email: string): boolean {
  const allowed = process.env.ALLOWED_EMAILS;
  if (allowed) {
    return allowed
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(email);
  }
  // No allowlist configured: open in dev, closed in production.
  return process.env.NODE_ENV !== "production";
}

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Password was correct but a 2FA code is required — show the code field */
  needTotp?: boolean;
} | null;

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") ?? "",
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "פרטים שגויים",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();
  const byEmail = rateLimit(`login:email:${email}`, { limit: 8, windowMs: 15 * 60_000 });
  const byIp = rateLimit(`login:ip:${ip}`, { limit: 25, windowMs: 15 * 60_000 });
  if (!byEmail.allowed || !byIp.allowed) {
    return { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות." };
  }

  // Two-step: if the password is right and 2FA is on but no code was given,
  // ask for the code instead of failing.
  if (!parsed.data.totp) {
    const user = await db.user.findUnique({
      where: { email },
      select: { hashedPassword: true, totpEnabled: true },
    });
    if (
      user?.hashedPassword &&
      user.totpEnabled &&
      (await bcrypt.compare(parsed.data.password, user.hashedPassword))
    ) {
      return { needTotp: true };
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp ?? "",
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return parsed.data.totp
          ? { error: "קוד האימות שגוי או שפג תוקפו", needTotp: true }
          : { error: "אימייל או סיסמה שגויים" };
      }
      return { error: "אירעה שגיאה בהתחברות" };
    }
    throw err;
  }

  redirect("/dashboard");
}

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "פרטים שגויים",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  const byIp = rateLimit(`register:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!byIp.allowed) {
    return { error: "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר." };
  }

  if (!registrationAllowed(email)) {
    return { error: "ההרשמה סגורה. פנה למנהל המערכת." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "כתובת אימייל זו כבר רשומה במערכת" };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      hashedPassword,
    },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    redirect("/login");
  }

  redirect("/dashboard");
}

export type ResetRequestState = {
  error?: string;
  sent?: boolean;
} | null;

export async function requestPasswordResetAction(
  _: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "כתובת אימייל לא תקינה" };
  }

  const ip = await clientIp();
  const byIp = rateLimit(`reset:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  const byEmail = rateLimit(`reset:email:${email}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!byIp.allowed || !byEmail.allowed) {
    return { error: "יותר מדי בקשות — נסו שוב מאוחר יותר" };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  // Always report success — never reveal whether the email is registered
  if (user) {
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
      process.env.NEXTAUTH_URL ??
      `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const { subject, html, text } = buildResetEmail({
      name: user.name,
      resetUrl: `${origin}/reset-password/${token}`,
    });
    const result = await sendEmail({ to: email, subject, html, text });
    if (!result.ok) {
      console.error("Reset email failed:", result.error);
      return { error: "שליחת האימייל נכשלה — נסו שוב או פנו לתמיכה" };
    }
  }

  return { sent: true };
}

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  done?: boolean;
} | null;

export async function resetPasswordAction(
  _: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "אנא תקנו את השגיאות בטופס",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");
  const user = await db.user.findFirst({
    where: { resetToken: tokenHash, resetTokenExpiry: { gt: new Date() } },
    select: { id: true },
  });
  if (!user) {
    return { error: "הקישור אינו תקף או שפג תוקפו — יש לבקש איפוס חדש" };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await db.user.update({
    where: { id: user.id },
    data: { hashedPassword, resetToken: null, resetTokenExpiry: null },
  });

  return { done: true };
}
