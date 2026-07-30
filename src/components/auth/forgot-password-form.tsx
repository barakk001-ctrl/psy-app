"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  type ResetRequestState,
} from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordResetAction,
    null,
  );

  if (state?.sent) {
    return (
      <div className="text-center space-y-4">
        <MailCheck className="w-12 h-12 mx-auto text-sage-600" />
        <h1 className="font-display text-2xl text-ink">בדקו את האימייל</h1>
        <p className="text-ink-muted text-sm max-w-sm mx-auto">
          אם הכתובת רשומה אצלנו, נשלח אליה עכשיו קישור לקביעת סיסמה חדשה. הקישור
          בתוקף לשעה אחת.
        </p>
        <Link href="/login" className="text-sm text-sage-600 hover:text-sage-700">
          חזרה להתחברות
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">שכחת סיסמה?</h1>
        <p className="text-ink-muted mt-2">
          נשלח לך קישור לאימייל לקביעת סיסמה חדשה.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
          />
        </div>

        {state?.error && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "שולח…" : "שליחת קישור איפוס"}
        </Button>
      </form>

      <p className="text-sm text-ink-muted mt-8 text-center">
        נזכרת?{" "}
        <Link href="/login" className="text-sage-600 hover:text-sage-700 font-medium">
          חזרה להתחברות
        </Link>
      </p>
    </div>
  );
}
