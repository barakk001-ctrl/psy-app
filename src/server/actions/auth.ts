"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import { loginSchema, registerSchema } from "@/server/validators/auth";

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
