"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REAUTH_LABELS, type ReauthMethod } from "@/lib/reauth";
import { sendReauthCodeAction } from "@/server/actions/account";

/** The field name is always `reauth`. An account without a password gets a send-code button. */
export function ReauthField({
  method,
  email,
  id,
}: {
  method: ReauthMethod;
  email: string;
  id: string;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{REAUTH_LABELS[method]}</Label>
      <Input
        id={id}
        name="reauth"
        type={method === "password" ? "password" : "text"}
        inputMode={method === "password" ? undefined : "text"}
        autoComplete={method === "password" ? "current-password" : "one-time-code"}
        dir="ltr"
        required
      />
      {method === "email" && (
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await sendReauthCodeAction();
                if ("error" in res) setError(res.error);
                else setSent(true);
              })
            }
          >
            {pending ? "שולח…" : sent ? "שליחה חוזרת" : "שליחת קוד"}
          </Button>
          {sent && !error && (
            <span className="inline-flex items-center gap-1.5 text-xs text-sage-700">
              <MailCheck className="w-3.5 h-3.5" />
              הקוד נשלח אל <span dir="ltr">{email}</span>
            </span>
          )}
          {error && <span className="text-xs text-terracotta-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
