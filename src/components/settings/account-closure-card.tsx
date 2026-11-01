"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReauthField } from "@/components/settings/reauth-field";
import {
  CLOSE_CONFIRM_PHRASE,
  CLOSURE_ACK_TEXT,
  CLOSURE_GRACE_DAYS,
  CLOSURE_WARNING,
} from "@/lib/account-closure";
import type { ReauthMethod } from "@/lib/reauth";
import { closeAccountAction } from "@/server/actions/account";

/** Settings → סגירת החשבון, right under the full download. */
export function AccountClosureCard({
  method,
  email,
  isAdmin,
}: {
  method: ReauthMethod;
  email: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      // On success the action redirects to /account-closed
      const res = await closeAccountAction(data);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorClosed className="w-5 h-5 text-terracotta-600" />
          סגירת החשבון
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">
          החשבון נסגר מיד: אי אפשר לעבוד בו, התזכורות נעצרות, וסנכרון היומן והטופס לבקשת פגישה מפסיקים
          לפעול. במשך {CLOSURE_GRACE_DAYS} יום אפשר להיכנס ולשחזר אותו כפי שהיה. אחרי {CLOSURE_GRACE_DAYS}{" "}
          יום כל המידע נמחק לצמיתות ולא ניתן לשחזור, ומהגיבויים בתוך {CLOSURE_GRACE_DAYS} יום נוספים.
        </p>

        {isAdmin ? (
          <p className="text-sm text-ink-muted">חשבון המפעיל לא נסגר מכאן.</p>
        ) : !open ? (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              המשך לסגירת החשבון
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 p-3 text-sm text-ink-soft leading-relaxed">
              <p className="flex items-center gap-1.5 font-medium text-terracotta-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                לפני שסוגרים
              </p>
              <p className="mt-1">{CLOSURE_WARNING}</p>
              <a href="#account-data" className="mt-2 inline-flex min-h-11 items-center underline">
                להורדת כל הנתונים
              </a>
            </div>

            <label className="flex min-h-11 items-start gap-2.5 text-sm text-ink-soft">
              <input type="checkbox" name="ack" required className="mt-1 h-4 w-4 shrink-0" />
              <span>{CLOSURE_ACK_TEXT}</span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="close-phrase">
                לאישור כותבים: <strong>{CLOSE_CONFIRM_PHRASE}</strong>
              </Label>
              <Input id="close-phrase" name="confirm" autoComplete="off" required />
            </div>

            <ReauthField method={method} email={email} id="close-reauth" />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-terracotta-600" role="alert">
                {error}
              </span>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={pending}>
                  {pending ? "סוגר…" : "סגירת החשבון"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
