"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { googleRegisterAction, registerAction, type FormState } from "@/server/actions/auth";

export function RegisterForm({
  googleEnabled = false,
  notice,
}: {
  /** Show "המשך עם Google" — only when the Google keys are configured */
  googleEnabled?: boolean;
  /** A message carried in the URL (e.g. Google sign-in needs the agreement first) */
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerAction,
    null,
  );
  // Controlled so the Google button can require it before leaving for Google
  const [agreed, setAgreed] = useState(false);
  const [googleHint, setGoogleHint] = useState(false);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">יצירת חשבון</h1>
        <p className="text-ink-muted mt-2">הקלינקה שלך, מסודרת במקום אחד</p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">שם מלא</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            invalid={!!state?.fieldErrors?.name}
          />
          {state?.fieldErrors?.name && (
            <p className="text-xs text-terracotta-600 mt-1">
              {state.fieldErrors.name[0]}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            invalid={!!state?.fieldErrors?.email}
          />
          {state?.fieldErrors?.email && (
            <p className="text-xs text-terracotta-600 mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            invalid={!!state?.fieldErrors?.password}
          />
          <p className="text-xs text-ink-subtle mt-1">
            לפחות 8 תווים, עם אות אחת וספרה אחת
          </p>
          {state?.fieldErrors?.password && (
            <p className="text-xs text-terracotta-600 mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2.5 rounded-xl border border-cream-300 bg-white/60 px-3.5 py-3 cursor-pointer">
          <input
            type="checkbox"
            name="agreement"
            required
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (e.target.checked) setGoogleHint(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-cream-300 accent-sage-600"
          />
          <span className="text-sm text-ink-soft leading-relaxed">
            קראתי ואני מסכימ/ה ל
            <Link
              href="/agreement"
              target="_blank"
              className="text-sage-600 hover:text-sage-700 font-medium"
            >
              הסכם החזקת המידע
            </Link>{" "}
            של המערכת
          </span>
        </label>
        {state?.fieldErrors?.agreement && (
          <p className="text-xs text-terracotta-600 -mt-2">
            {state.fieldErrors.agreement[0]}
          </p>
        )}

        {googleHint && (
          <p className="text-xs text-terracotta-600 -mt-2">
            כדי להמשיך עם Google יש לסמן קודם את אישור ההסכם
          </p>
        )}

        {(state?.error ?? (state ? undefined : notice)) && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state?.error ?? notice}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "יוצר חשבון…" : "יצירת חשבון"}
        </Button>

        {googleEnabled && (
          <>
            <OrDivider />
            <p className="text-xs text-ink-subtle -mt-3 mb-3 text-center">
              בלי סיסמה — נכנסים עם חשבון Google (עם אישור ההסכם שלמעלה)
            </p>
            {/* Same form, so the agreement checkbox travels with it */}
            <GoogleButton
              formAction={googleRegisterAction}
              onClick={(e) => {
                if (!agreed) {
                  e.preventDefault();
                  setGoogleHint(true);
                }
              }}
            />
          </>
        )}
      </form>

      <p className="text-sm text-ink-muted mt-8 text-center">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="text-sage-600 hover:text-sage-700 font-medium">
          התחברות
        </Link>
      </p>
    </div>
  );
}
