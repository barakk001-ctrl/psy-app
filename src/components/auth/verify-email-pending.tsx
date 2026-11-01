"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendVerificationAction, type VerifyEmailResendState } from "@/server/actions/auth";

/**
 * After a sign-up, or a sign-in to an account that hasn't confirmed its
 * address. The wording never says whether a mail went out: for an address that
 * already has an account the same screen shows and its owner gets a notice.
 */
export function VerifyEmailPending({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<VerifyEmailResendState, FormData>(
    resendVerificationAction,
    null,
  );

  return (
    <div className="text-center space-y-4">
      <MailCheck className="w-12 h-12 mx-auto text-sage-600" aria-hidden />
      {/* This screen replaces the form: announced, or nothing would tell a screen reader */}
      <div role="status" className="space-y-4">
        <h1 className="font-display text-2xl text-ink">בדקו את האימייל</h1>
        <p className="text-ink-muted text-sm max-w-sm mx-auto leading-relaxed">
          כדי לסיים את פתיחת החשבון יש ללחוץ על הקישור שנשלח אל{" "}
          <span dir="ltr" className="font-medium text-ink-soft">{email}</span>. הקישור בתוקף ל-24 שעות.
        </p>
      </div>
      <p className="text-ink-muted text-sm">לא הגיע תוך דקה-שתיים? כדאי לבדוק גם בתיקיית הספאם.</p>

      {state?.sent && (
        <div role="status" className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
          נשלח קישור חדש. הקישור הקודם כבר לא תקף.
        </div>
      )}
      {state?.error && (
        <div role="alert" className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? "שולח…" : "שליחה מחדש"}
        </Button>
      </form>

      <p className="text-sm">
        <Link href="/login" className="text-sage-600 hover:text-sage-700 font-medium">
          חזרה להתחברות
        </Link>
      </p>
    </div>
  );
}
