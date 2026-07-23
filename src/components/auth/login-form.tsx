"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type FormState } from "@/server/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    null,
  );
  // Controlled so values survive the two-step (password → 2FA code) flow;
  // React 19 resets uncontrolled fields after each form action.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");

  const needTotp = !!state?.needTotp;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">ברוך שובך</h1>
        <p className="text-ink-muted mt-2">היכנס לחשבון שלך כדי להמשיך</p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <div className={needTotp ? "hidden" : undefined}>
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!state?.fieldErrors?.email}
          />
          {state?.fieldErrors?.email && (
            <p className="text-xs text-terracotta-600 mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className={needTotp ? "hidden" : undefined}>
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!state?.fieldErrors?.password}
          />
          {state?.fieldErrors?.password && (
            <p className="text-xs text-terracotta-600 mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {needTotp && (
          <>
            <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              אימות דו-שלבי פעיל — הזינו את הקוד מאפליקציית האימות
            </div>
            <div>
              <Label htmlFor="totp">קוד אימות</Label>
              <Input
                id="totp"
                name="totp"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={9}
                dir="ltr"
                className="text-center tracking-[0.3em] font-medium"
                value={totp}
                onChange={(e) =>
                  setTotp(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                }
                autoFocus
              />
              <p className="text-xs text-ink-subtle mt-1">
                אפשר גם להזין קוד גיבוי חד-פעמי (XXXX-XXXX)
              </p>
            </div>
          </>
        )}

        {state?.error && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "מתחבר…" : needTotp ? "אימות והתחברות" : "התחברות"}
        </Button>
      </form>

      <p className="text-sm text-ink-muted mt-8 text-center">
        אין לך חשבון עדיין?{" "}
        <Link href="/register" className="text-sage-600 hover:text-sage-700 font-medium">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
