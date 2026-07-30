"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  if (state?.done) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-sage-600" />
        <h1 className="font-display text-2xl text-ink">הסיסמה עודכנה!</h1>
        <p className="text-ink-muted text-sm">אפשר להתחבר עם הסיסמה החדשה.</p>
        <Link href="/login" className="inline-block">
          <Button size="lg">להתחברות</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">סיסמה חדשה</h1>
        <p className="text-ink-muted mt-2">
          לפחות 8 תווים, עם אות אחת וספרה אחת.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />

        <div>
          <Label htmlFor="password">סיסמה חדשה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            invalid={!!fieldErr.password}
          />
          {fieldErr.password && (
            <p className="text-xs text-terracotta-600 mt-1">{fieldErr.password[0]}</p>
          )}
        </div>

        <div>
          <Label htmlFor="confirm">אימות סיסמה</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            invalid={!!fieldErr.confirm}
          />
          {fieldErr.confirm && (
            <p className="text-xs text-terracotta-600 mt-1">{fieldErr.confirm[0]}</p>
          )}
        </div>

        {state?.error && !state.fieldErrors && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "מעדכן…" : "עדכון הסיסמה"}
        </Button>
      </form>

      <p className="text-sm text-ink-muted mt-8 text-center">
        <Link href="/forgot-password" className="text-sage-600 hover:text-sage-700">
          הקישור פג? בקשת איפוס חדש
        </Link>
      </p>
    </div>
  );
}
