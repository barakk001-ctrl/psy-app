"use client";

import { useState } from "react";
import { CalendarPlus, Copy, RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  calendarFeedDisableAction,
  calendarFeedEnableAction,
  calendarFeedModeAction,
} from "@/server/actions/settings";

export function CalendarFeedCard({
  token,
  mode,
  origin,
}: {
  token: string | null;
  mode: string;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = token ? `${origin}/api/calendar/${token}` : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="w-5 h-5 text-sage-600" />
          סנכרון ליומן גוגל
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          הפגישות מהמערכת יופיעו ביומן גוגל (או בכל יומן אחר) באמצעות קישור
          מנוי פרטי. גוגל מרענן יומנים כאלה אחת לכמה שעות — שינויים לא יופיעו
          מיידית.
        </p>

        {!token ? (
          <form action={calendarFeedEnableAction}>
            <Button type="submit" size="sm">
              הפעלת הסנכרון
            </Button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 min-w-0 truncate rounded-xl border border-cream-300 bg-white/60 px-3 py-2 text-xs text-ink-muted"
              >
                {url}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={copy}>
                <Copy className="w-3.5 h-3.5" />
                {copied ? "הועתק!" : "העתקה"}
              </Button>
            </div>

            <form action={calendarFeedModeAction} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="f-mono text-[10px] uppercase tracking-[0.2em] opacity-55 block mb-1">
                  איך יוצגו שמות המטופלים ביומן
                </label>
                <Select name="mode" defaultValue={mode}>
                  <option value="FIRST">שם פרטי בלבד (מומלץ)</option>
                  <option value="FULL">שם מלא</option>
                  <option value="NONE">ללא שם — רק &quot;פגישה&quot;</option>
                </Select>
              </div>
              <Button type="submit" size="sm" variant="secondary">
                שמירה
              </Button>
            </form>

            <details className="bg-cream-100/60 border border-cream-200 rounded-xl px-3 py-2.5">
              <summary className="text-sm font-semibold cursor-pointer">
                איך מוסיפים ליומן גוגל?
              </summary>
              <ol className="text-xs text-ink-muted mt-2 space-y-1.5 list-decimal ps-4 leading-relaxed">
                <li>העתיקו את הקישור למעלה.</li>
                <li>
                  פתחו את יומן גוגל במחשב ← בעמודה &quot;יומנים אחרים&quot; לחצו
                  + ← &quot;מכתובת URL&quot;.
                </li>
                <li>הדביקו את הקישור ולחצו &quot;הוספת יומן&quot;.</li>
                <li>היומן יופיע גם באפליקציית היומן בטלפון.</li>
              </ol>
            </details>

            <div className="flex flex-wrap gap-3 text-xs">
              <form action={calendarFeedEnableAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                  title="מחליף את הקישור — הקישור הישן יפסיק לעבוד"
                >
                  <RefreshCw className="w-3 h-3" /> החלפת קישור
                </button>
              </form>
              <form action={calendarFeedDisableAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-terracotta-600 hover:text-terracotta-500"
                >
                  <X className="w-3 h-3" /> ביטול הסנכרון
                </button>
              </form>
            </div>
            <p className="text-xs text-ink-subtle">
              הקישור הוא סוד — מי שמחזיק בו רואה את לוח הפגישות. אם דלף, לחצו
              &quot;החלפת קישור&quot;.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
