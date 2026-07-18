"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { signIn, signOut } from "@/auth";
import { loginSchema, registerSchema } from "@/server/validators/auth";

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
} | null;

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
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
  const byEmail = rateLimit(`login:email:${email}`, { limit: 5, windowMs: 15 * 60_000 });
  const byIp = rateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!byEmail.allowed || !byIp.allowed) {
    return { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: "אימייל או סיסמה שגויים" };
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
