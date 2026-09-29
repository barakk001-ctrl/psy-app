"use client";

import { startTransition, useActionState, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelTwoFactorAction,
  verifyTwoFactorAction,
  type TwoFactorState,
} from "@/server/actions/auth";

export function TwoFactorForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState<TwoFactorState, FormData>(
    verifyTwoFactorAction,
    null,
  );
  // Controlled: a wrong code stays in the box to be corrected
  const [code, setCode] = useState("");

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink">אימות דו-שלבי</h1>
        <p className="text-ink-muted mt-2">
          התחברת עם Google{email ? <> כ-<span dir="ltr">{email}</span></> : null}. נשאר רק הקוד.
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
        <div className="rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          הזינו את הקוד מאפליקציית האימות
        </div>
        <div>
          <Label htmlFor="code">קוד אימות</Label>
          <Input
            id="code"
            name="code"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={9}
            dir="ltr"
            className="text-center tracking-[0.3em] font-medium"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            autoFocus
          />
          <p className="text-xs text-ink-subtle mt-1">
            אפשר גם להזין קוד גיבוי חד-פעמי (XXXX-XXXX)
          </p>
        </div>

        {state?.error && (
          <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "מאמת…" : "אימות והתחברות"}
        </Button>
      </form>

      <form action={cancelTwoFactorAction} className="mt-6 text-center">
        <button type="submit" className="text-sm text-sage-600 hover:text-sage-700">
          התחברות עם חשבון אחר
        </button>
      </form>
    </div>
  );
}
