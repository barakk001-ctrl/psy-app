"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { AGREEMENT_VERSION } from "@/lib/agreement";
import { INVITE_ONLY_MESSAGE, canCreateAccount } from "@/lib/signup-policy";
import { rateLimit } from "@/lib/rate-limit";
import { createPracticeUser } from "@/lib/practice-user";
import { sendPasswordResetLink } from "@/lib/password-reset";
import { LOGIN_CODE_LIMITS, loginCodeRateKeys, normalizeLoginCode } from "@/lib/login-code";
import { createLoginCode } from "@/lib/login-code-store";
import { sendLoginCode } from "@/lib/login-code-channel";
import {
  GOOGLE_AGREEMENT_COOKIE,
  GOOGLE_AGREEMENT_COOKIE_MAX_AGE_S,
  isGoogleConfigured,
} from "@/lib/google-auth";
import { auth, signIn, signOut } from "@/auth";
import { TWO_FACTOR_PATH } from "@/lib/auth-gate";
import {
  loginCodeRequestSchema,
  loginCodeVerifySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/server/validators/auth";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

/**
 * Automatic sign-out after inactivity (src/components/security/idle-guard.tsx).
 * No redirect: the page then does a full load of /login itself, so nothing of
 * the signed-in page stays in memory or in the router cache.
 */
export async function idleSignOutAction(): Promise<void> {
  await signOut({ redirect: false });
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

  const user = await db.user.findUnique({
    where: { email },
    select: { hashedPassword: true, totpEnabled: true },
  });

  // An account opened through Google has no password to check.
  if (user && !user.hashedPassword) {
    return {
      error: isGoogleConfigured()
        ? "לחשבון הזה אין סיסמה — הוא נפתח דרך Google. התחברו עם \"המשך עם Google\", או קבעו סיסמה דרך \"שכחת סיסמה?\"."
        : "לחשבון הזה אין סיסמה. אפשר לקבוע סיסמה דרך \"שכחת סיסמה?\".",
    };
  }

  // Two-step: if the password is right and 2FA is on but no code was given,
  // ask for the code instead of failing.
  if (!parsed.data.totp) {
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

  // The data-holding agreement is a precondition for holding any clinical data
  if (formData.get("agreement") !== "on") {
    return {
      error: "יש לאשר את הסכם החזקת המידע כדי להירשם",
      fieldErrors: { agreement: ["נדרש אישור ההסכם"] },
    };
  }

  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  const byIp = rateLimit(`register:ip:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!byIp.allowed) {
    return { error: "יותר מדי ניסיונות הרשמה. נסה שוב מאוחר יותר." };
  }

  // By invitation while SIGNUP_OPEN is off (signup-policy.ts); an address
  // that already has an account gets the "already registered" answer below
  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!existingUser && !canCreateAccount(email)) {
    return { error: INVITE_ONLY_MESSAGE };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "כתובת אימייל זו כבר רשומה במערכת" };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await createPracticeUser({ email, name: parsed.data.name, hashedPassword });

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
    select: { id: true, name: true, email: true },
  });

  // Always report success — never reveal whether the email is registered
  if (user) {
    const result = await sendPasswordResetLink(user);
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

// ── Google sign-in ─────────────────────────────────────────────────

/** "המשך עם Google" on the login page. A new email is sent on to /register for the agreement. */
export async function googleSignInAction() {
  if (!isGoogleConfigured()) redirect("/login");
  await signIn("google", { redirectTo: "/dashboard" });
}

/**
 * "המשך עם Google" on the register page: the data-holding agreement must be
 * ticked first (same precondition as the email form); the acceptance travels
 * through Google's round-trip in a short-lived cookie read by auth.ts.
 */
export async function googleRegisterAction(formData: FormData) {
  if (!isGoogleConfigured()) redirect("/register");
  if (formData.get("agreement") !== "on") redirect("/register?google=agreement");

  (await cookies()).set(GOOGLE_AGREEMENT_COOKIE, AGREEMENT_VERSION, {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_AGREEMENT_COOKIE_MAX_AGE_S,
  });
  await signIn("google", { redirectTo: "/dashboard" });
}

export type TwoFactorState = { error?: string } | null;

/**
 * /login/two-factor: the 6-digit code (or a backup code) after a Google
 * sign-in. Only a correct code turns the pending session into a real one.
 */
export async function verifyTwoFactorAction(
  _: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const session = await auth();
  if (!session?.twoFactorPending) redirect("/login?error=2fa_expired");

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "יש להזין את קוד האימות" };

  try {
    await signIn("two-factor", { code, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        if ((err as AuthError & { code?: string }).code === "rate_limited") {
          return { error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות." };
        }
        // The pending window may have lapsed while typing
        const still = await auth();
        if (!still?.twoFactorPending) redirect("/login?error=2fa_expired");
        return { error: "קוד האימות שגוי או שפג תוקפו" };
      }
      return { error: "אירעה שגיאה בהתחברות" };
    }
    throw err;
  }

  redirect("/dashboard");
}

/** "התחברות עם חשבון אחר" on the code page — drops the pending session. */
export async function cancelTwoFactorAction() {
  await signOut({ redirectTo: "/login" });
}

// ── One-time code sign-in ("כניסה עם קוד חד פעמי") ─────────────────

export type LoginCodeState = {
  error?: string;
  /** Step two: the code was (as far as the visitor can tell) sent */
  sent?: boolean;
  email?: string;
} | null;

/**
 * Step one on /login/code: emails a 6-digit code (src/lib/login-code.ts).
 * Answers the same for a registered and an unknown address, and doesn't wait
 * for the email to go out, so neither the reply nor its timing tells whether
 * the address has an account. Send failures go to the server log
 * (sendEmail logs the reason).
 */
export async function requestLoginCodeAction(
  _: LoginCodeState,
  formData: FormData,
): Promise<LoginCodeState> {
  const parsed = loginCodeRequestSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { error: "כתובת אימייל לא תקינה" };
  const email = parsed.data.email.toLowerCase();

  const keys = loginCodeRateKeys(email, await clientIp());
  const byEmail = rateLimit(keys.sendPerEmail, LOGIN_CODE_LIMITS.sendPerEmail);
  const byIp = rateLimit(keys.sendPerIp, LOGIN_CODE_LIMITS.sendPerIp);
  if (!byEmail.allowed || !byIp.allowed) {
    return { error: "נשלחו יותר מדי קודים. נסו שוב בעוד כמה דקות, או התחברו עם סיסמה." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, loginPhone: true },
  });
  if (user) {
    const code = await createLoginCode(user.id);
    void sendLoginCode(user, code)
      .then((r) => {
        if (!r.ok) console.error(`[login-code] ${r.channel} send failed`);
      })
      .catch(() => console.error("[login-code] send threw"));
  }

  return { sent: true, email };
}

/** Step two: the code. With 2FA on, the session is pending and the
 *  middleware takes her on to /login/two-factor for the authenticator code. */
export async function verifyLoginCodeAction(
  _: LoginCodeState,
  formData: FormData,
): Promise<LoginCodeState> {
  const parsed = loginCodeVerifySchema.safeParse({
    email: formData.get("email") ?? "",
    code: formData.get("code") ?? "",
  });
  if (!parsed.success) return { sent: true, error: "יש להזין את הקוד שקיבלת" };
  const email = parsed.data.email.toLowerCase();

  const code = normalizeLoginCode(parsed.data.code);
  if (!code) return { sent: true, email, error: "הקוד מורכב מ-6 ספרות" };

  try {
    await signIn("email-code", { email, code, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        if ((err as AuthError & { code?: string }).code === "rate_limited") {
          return { sent: true, email, error: "יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות." };
        }
        return {
          sent: true,
          email,
          error: "הקוד שגוי או שפג תוקפו. בדקו שהוזן הקוד האחרון שנשלח, או שלחו קוד חדש.",
        };
      }
      return { sent: true, email, error: "אירעה שגיאה בהתחברות" };
    }
    throw err;
  }

  // Straight to the authenticator step when the session is pending, so the
  // address bar (and that form's own post) is /login/two-factor, not a
  // redirected /dashboard.
  const user = await db.user.findUnique({ where: { email }, select: { totpEnabled: true, totpSecret: true } });
  redirect(user?.totpEnabled && user.totpSecret ? TWO_FACTOR_PATH : "/dashboard");
}
