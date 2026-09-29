"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  changePasswordAction,
  sendSetPasswordLinkAction,
  type SetPasswordLinkState,
  type SettingsFormState,
} from "@/server/actions/settings";

const FIELDS = [
  { name: "current", label: "סיסמה נוכחית", autoComplete: "current-password" },
  { name: "password", label: "סיסמה חדשה", autoComplete: "new-password" },
  { name: "confirm", label: "אימות הסיסמה החדשה", autoComplete: "new-password" },
] as const;

/**
 * Settings → סיסמה. An account opened through Google has no password: instead
 * of the change form it gets a button that emails a "set a password" link.
 */
export function ChangePasswordCard({ hasPassword = true, email }: { hasPassword?: boolean; email?: string }) {
  return hasPassword ? <ChangePasswordForm /> : <SetPasswordByEmail email={email} />;
}

function SetPasswordByEmail({ email }: { email?: string }) {
  const [state, formAction, pending] = useActionState<SetPasswordLinkState, FormData>(
    sendSetPasswordLinkAction,
    null,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-sage-600" />
          סיסמה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">
          החשבון נפתח דרך Google ואין לו סיסמה — נכנסים עם &quot;המשך עם Google&quot;. כדי להתחבר גם
          עם אימייל וסיסמה, נשלח קישור לקביעת סיסמה אל{" "}
          {email ? <span dir="ltr">{email}</span> : "כתובת האימייל של החשבון"}.
        </p>
        {state?.sent ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-sage-600">
            <MailCheck className="w-4 h-4" /> הקישור נשלח. הוא בתוקף לשעה אחת.
          </p>
        ) : (
          <form action={formAction} className="flex items-center justify-between gap-3">
            <span className="text-xs text-terracotta-600">{state?.error}</span>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שולח…" : "שליחת קישור לקביעת סיסמה"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(changePasswordAction, null);
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErr = state?.fieldErrors ?? {};

  // Clear the fields only once the change succeeded; a refused save keeps what was typed
  useEffect(() => {
    if (state?.saved) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-sage-600" />
          שינוי סיסמה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          <p className="text-xs text-ink-muted">
            לפחות 8 תווים, עם אות אחת וספרה אחת לפחות. בפעם הבאה שתתחברו — עם הסיסמה החדשה.
          </p>
          {FIELDS.map((f) => (
            <div key={f.name}>
              <Label htmlFor={`pw-${f.name}`}>{f.label}</Label>
              <Input
                id={`pw-${f.name}`}
                name={f.name}
                type={show ? "text" : "password"}
                autoComplete={f.autoComplete}
                dir="ltr"
                invalid={!!fieldErr[f.name]}
              />
              {fieldErr[f.name] && <p className="text-xs text-terracotta-600 mt-1">{fieldErr[f.name][0]}</p>}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {show ? "הסתרת הסיסמאות" : "הצגת הסיסמאות"}
          </button>

          {state?.error && (
            <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              {state.error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs">
              {state?.saved && !pending && (
                <span className="inline-flex items-center gap-1 text-sage-600">
                  <Check className="w-3.5 h-3.5" /> הסיסמה עודכנה
                </span>
              )}
            </span>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "מעדכן…" : "עדכון סיסמה"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
