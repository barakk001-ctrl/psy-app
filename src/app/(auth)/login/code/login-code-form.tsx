"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestLoginCodeAction,
  verifyLoginCodeAction,
  type LoginCodeState,
} from "@/server/actions/auth";

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
      {children}
    </div>
  );
}

export function LoginCodeForm({ initialEmail }: { initialEmail: string }) {
  const [sendState, sendAction, sending] = useActionState<LoginCodeState, FormData>(
    requestLoginCodeAction,
    null,
  );
  const [verifyState, verifyAction, verifying] = useActionState<LoginCodeState, FormData>(
    verifyLoginCodeAction,
    null,
  );
  // Controlled, so both survive the actions (React 19 resets uncontrolled fields)
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [resent, setResent] = useState(false);

  const step = sendState?.sent && !editing ? "code" : "email";

  const send = (fd: FormData, again: boolean) => {
    setResent(again);
    setEditing(false);
    if (again) setCode("");
    startTransition(() => sendAction(fd));
  };

  if (step === "email") {
    return (
      <div>
        <div className="mb-8">
          <h1 className="font-display text-3xl text-ink">כניסה עם קוד חד פעמי</h1>
          <p className="text-ink-muted mt-2">
            נשלח קוד בן 6 ספרות לכתובת האימייל של החשבון — בלי סיסמה.
          </p>
        </div>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send(new FormData(e.currentTarget), false);
          }}
        >
          <div>
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {sendState?.error && <ErrorBox>{sendState.error}</ErrorBox>}

          <Button type="submit" size="lg" disabled={sending} className="w-full">
            {sending ? "שולח…" : "שליחת קוד"}
          </Button>
        </form>

        <p className="text-sm text-ink-muted mt-8 text-center">
          <Link href="/login" className="text-sage-600 hover:text-sage-700 font-medium">
            חזרה לכניסה עם סיסמה
          </Link>
        </p>
      </div>
    );
  }

  const sentTo = sendState?.email ?? email;
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">הזינו את הקוד</h1>
        <p className="text-ink-muted mt-2 flex items-start gap-2">
          <MailCheck className="w-5 h-5 shrink-0 text-sage-600 mt-0.5" />
          <span>
            אם הכתובת <span dir="ltr" className="font-medium text-ink-soft">{sentTo}</span> רשומה
            במערכת, שלחנו אליה עכשיו קוד בן 6 ספרות. הקוד בתוקף ל-10 דקות ולשימוש אחד.
          </span>
        </p>
      </div>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setResent(false);
          const fd = new FormData(e.currentTarget);
          startTransition(() => verifyAction(fd));
        }}
      >
        <input type="hidden" name="email" value={sentTo} />
        <div>
          <Label htmlFor="code">קוד כניסה</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={7}
            dir="ltr"
            className="text-center text-lg tracking-[0.4em] font-medium"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩۰-۹]/g, "").slice(0, 6))}
            autoFocus
            invalid={!!verifyState?.error}
          />
        </div>

        {resent && !sending && !sendState?.error && (
          <div role="status" className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700">
            נשלח קוד חדש. הקוד הקודם כבר לא תקף.
          </div>
        )}
        {sendState?.error && <ErrorBox>{sendState.error}</ErrorBox>}
        {verifyState?.error && !resent && <ErrorBox>{verifyState.error}</ErrorBox>}

        <Button type="submit" size="lg" disabled={verifying || code.length < 6} className="w-full">
          {verifying ? "מתחבר…" : "כניסה"}
        </Button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm text-ink-muted">
        <p>לא הגיע תוך דקה-שתיים? כדאי לבדוק גם בתיקיית הספאם.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(new FormData(e.currentTarget), true);
          }}
        >
          <input type="hidden" name="email" value={sentTo} />
          <button
            type="submit"
            disabled={sending}
            className="text-sage-600 hover:text-sage-700 font-medium disabled:opacity-60"
          >
            {sending ? "שולח…" : "שליחת קוד חדש"}
          </button>
        </form>
        <p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sage-600 hover:text-sage-700"
          >
            שינוי כתובת האימייל
          </button>
          {" · "}
          <Link href="/login" className="text-sage-600 hover:text-sage-700">
            כניסה עם סיסמה
          </Link>
        </p>
      </div>
    </div>
  );
}
