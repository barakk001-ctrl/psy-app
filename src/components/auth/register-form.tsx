"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type FormState } from "@/server/actions/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerAction,
    null,
  );

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

        {state?.error && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "יוצר חשבון…" : "יצירת חשבון"}
        </Button>
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
