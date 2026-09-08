"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  saveMorningSettingsAction,
  disconnectMorningAction,
  type MorningSettingsState,
} from "@/server/actions/settings";

export function MorningSettingsForm({
  connected,
  keyIdMasked,
  sandbox,
  docType,
}: {
  connected: boolean;
  keyIdMasked: string | null;
  sandbox: boolean;
  docType: number;
}) {
  const [state, formAction, pending] = useActionState<MorningSettingsState, FormData>(
    saveMorningSettingsAction,
    null,
  );
  // When connected, the key-entry form stays hidden unless replacing the key.
  const [replacingKey, setReplacingKey] = useState(false);
  const showSetup = !connected || replacingKey;

  return (
    <Card>
      <CardHeader>
        <CardTitle>חיבור ל-morning (חשבונית ירוקה)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-2 text-sage-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              מחובר ✓
              <span className="font-normal text-sage-700/80" dir="ltr">
                {keyIdMasked}
              </span>
              <span className="font-normal text-sage-700/80">
                {sandbox ? "· סביבת ניסיון" : "· סביבת אמת"}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setReplacingKey((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink px-2 py-1"
              >
                <KeyRound className="w-3 h-3" />
                {replacingKey ? "ביטול החלפה" : "החלפת מפתח"}
              </button>
              <form action={disconnectMorningAction}>
                <Button type="submit" variant="ghost" size="sm">
                  ניתוק
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted leading-relaxed">
            חיבור החשבון מאפשר להפיק קבלות רשמיות ב-morning ישירות מתוך חשבונית
            באפליקציה — בלחיצת כפתור, בלי הקלדה כפולה. מגדירים פעם אחת —
            ומכאן והלאה המערכת מתחברת לבד.
          </p>
        )}

        {showSetup && (
          <div className="rounded border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft space-y-1.5">
            <div className="font-medium text-ink">איך משיגים את המפתחות מ-morning?</div>
            <ol className="list-decimal ps-5 space-y-1 text-ink-soft">
              <li>
                נכנסים לחשבון ב-
                <a
                  href="https://app.greeninvoice.co.il"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage-600 hover:text-sage-700"
                >
                  app.greeninvoice.co.il
                </a>
              </li>
              <li>הגדרות ← החשבון שלי ← כלים למפתחים (Developer Tools) ← מפתחות API</li>
              <li>לוחצים על ״הוספת מפתח״ ומעתיקים את ה-ID ואת ה-Secret לכאן</li>
            </ol>
            <p className="text-xs text-ink-muted pt-1">
              שימו לב: גישת API זמינה במסלולים המתקדמים של morning. אם לא רואים את
              ״כלים למפתחים״ בתפריט — צריך לשדרג מסלול. המפתח הסודי נשמר כאן מוצפן.
            </p>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {showSetup && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="morningApiKeyId">מזהה מפתח (API Key ID)</Label>
                <Input
                  id="morningApiKeyId"
                  name="morningApiKeyId"
                  dir="ltr"
                  autoComplete="off"
                  placeholder="xxxxxxxx-xxxx-…"
                />
              </div>
              <div>
                <Label htmlFor="morningApiSecret">מפתח סודי (Secret)</Label>
                <Input
                  id="morningApiSecret"
                  name="morningApiSecret"
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="morningDocType">סוג המסמך שמופק ב-morning</Label>
            <Select id="morningDocType" name="morningDocType" defaultValue={String(docType)}>
              <option value="400">קבלה (מתאים לעוסק פטור)</option>
              <option value="320">חשבונית מס-קבלה מאוחדת (מתאים לעוסק מורשה)</option>
            </Select>
          </div>

          {showSetup ? (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  name="morningSandbox"
                  defaultChecked={sandbox}
                  className="h-4 w-4 rounded border-cream-300 accent-sage-600"
                />
                סביבת ניסיון (Sandbox) — מסמכים לא אמיתיים
              </label>
              <p className="text-xs text-ink-muted ps-6">
                שימו לב: ל-Sandbox יש חשבון נפרד ומפתחות נפרדים — נרשמים ב-
                <a
                  href="https://lp.sandbox.d.greeninvoice.co.il/join/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage-600 hover:text-sage-700"
                  dir="ltr"
                >
                  lp.sandbox.d.greeninvoice.co.il/join
                </a>
                . מפתחות מהחשבון האמיתי עובדים רק כשהתיבה <b>לא</b> מסומנת —
                אחרת מתקבלת שגיאת 401.
              </p>
            </div>
          ) : (
            // Preserve the current environment on preference-only saves
            <input type="hidden" name="morningSandbox" value={sandbox ? "on" : ""} />
          )}

          {state?.error && (
            <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              {state.error}
            </div>
          )}
          {state?.saved && (
            <div className="rounded border border-sage-100 bg-sage-50 px-3 py-2 text-sm text-sage-700">
              {showSetup ? "החיבור נבדק ונשמר בהצלחה ✓" : "ההגדרות נשמרו ✓"}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending
                ? "שומר…"
                : showSetup
                  ? "בדיקה ושמירה"
                  : "שמירת הגדרות"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
