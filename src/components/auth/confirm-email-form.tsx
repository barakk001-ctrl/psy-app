"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmEmailAction, type ConfirmEmailState } from "@/server/actions/auth";

export function LinkExpired() {
  return (
    <div className="text-center space-y-4">
      <h1 className="font-display text-2xl text-ink">הקישור אינו תקף</h1>
      <p className="text-ink-muted text-sm max-w-sm mx-auto leading-relaxed">
        ייתכן שפג תוקפו, שכבר השתמשו בו או שנשלח קישור חדש אחריו. התחברות עם האימייל והסיסמה תאפשר
        לשלוח קישור חדש, ואם הכתובת כבר אושרה פשוט ייכנסו למערכת.
      </p>
      <Link href="/login" className="text-sm text-sage-600 hover:text-sage-700 font-medium">
        להתחברות
      </Link>
    </div>
  );
}

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ConfirmEmailState, FormData>(
    confirmEmailAction,
    null,
  );

  if (state?.expired) return <LinkExpired />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">אישור כתובת האימייל</h1>
        <p className="text-ink-muted mt-2">
          נשאר רק להזין את הסיסמה שנבחרה בהרשמה, וסיימנו.
        </p>
      </div>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            invalid={!!state?.error}
          />
        </div>

        {state?.error && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "מאשר…" : "אישור וכניסה"}
        </Button>
      </form>

      <p className="text-sm text-ink-muted mt-8 text-center">
        לא זוכרים את הסיסמה?{" "}
        <Link href="/forgot-password" className="text-sage-600 hover:text-sage-700 font-medium">
          קביעת סיסמה חדשה
        </Link>
      </p>
    </div>
  );
}
