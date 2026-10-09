"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateIdleTimeoutAction, type SettingsFormState } from "@/server/actions/settings";
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_OPTIONS,
  idleTimeoutLabel,
  type IdleTimeoutMinutes,
} from "@/lib/idle-timeout";

/** Settings → ניתוק אוטומטי: how long without activity before signing out. */
export function IdleTimeoutCard({ minutes }: { minutes: IdleTimeoutMinutes }) {
  const [selected, setSelected] = useState<IdleTimeoutMinutes>(minutes);
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateIdleTimeoutAction,
    null,
  );

  function choose(value: IdleTimeoutMinutes) {
    if (value === selected || pending) return;
    setSelected(value);
    const fd = new FormData();
    fd.set("minutes", String(value));
    startTransition(() => formAction(fd));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-sage-600" />
          ניתוק אוטומטי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          אחרי זמן ללא פעילות המערכת מתנתקת, וכדי להיכנס שוב יש להזין סיסמה. שתי דקות
          לפני כן מופיעה הודעה עם כפתור ״המשך״. בזמן עבודה זה לא קורה, וסיכום פגישה שלא
          נשמר נשמר אוטומטית לפני הניתוק. בכל מקרה, יש להתחבר מחדש אחרי 12 שעות.
        </p>

        <div role="radiogroup" aria-label="ניתוק אחרי" className="flex flex-wrap gap-2">
          {IDLE_TIMEOUT_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected === value}
              disabled={pending}
              onClick={() => choose(value)}
              className={cn(
                "h-10 px-4 rounded-xl border text-sm transition-colors",
                selected === value
                  ? "bg-sage-600 border-sage-600 text-cream-50"
                  : "bg-white/70 border-cream-300 text-ink hover:border-cream-400",
              )}
            >
              {idleTimeoutLabel(value)}
              {value === DEFAULT_IDLE_TIMEOUT_MINUTES && (
                <span className={selected === value ? "text-cream-100" : "text-ink-subtle"}>
                  {" "}
                  (מומלץ)
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-xs min-h-4">
          {pending && <span className="text-ink-subtle">שומר…</span>}
          {!pending && state?.saved && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              נשמר — ניתוק אחרי {idleTimeoutLabel(selected)} ללא פעילות
            </span>
          )}
          {!pending && state?.error && <span className="text-terracotta-600">{state.error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
