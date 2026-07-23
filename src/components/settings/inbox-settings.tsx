"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  generateInboxTokenAction,
  revokeInboxTokenAction,
} from "@/server/actions/inbox";

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <div className="space-y-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code
          dir="ltr"
          className="flex-1 min-w-0 truncate rounded-lg bg-cream-100 border border-cream-300 px-3 py-2 text-xs text-ink-soft"
        >
          {value}
        </code>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="w-4 h-4 text-sage-600" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export function InboxSettings({ token }: { token: string | null }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>קליטת הודעות מבחוץ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-ink-muted leading-relaxed">
          מאפשר לשלוח הודעות עם פרטי פגישה ישירות לאפליקציה — מקיצור דרך באייפון,
          מטופס אינטרנטי ללקוחות, או מכל אוטומציה. ההודעות מחכות בעמוד ״ייבוא
          פגישה מהודעה״.
        </p>

        {!token ? (
          <form action={generateInboxTokenAction}>
            <Button type="submit">
              <Link2 className="w-4 h-4" />
              הפעלה — יצירת מפתח אישי
            </Button>
          </form>
        ) : (
          <>
            {origin && (
              <div className="space-y-3">
                <CopyRow
                  label="טופס בקשת פגישה ללקוחות (אפשר לשלוח את הקישור)"
                  value={`${origin}/request/${token}`}
                />
                <CopyRow
                  label="כתובת ה-API (לקיצור דרך / אוטומציות)"
                  value={`${origin}/api/inbox?token=${token}`}
                />
              </div>
            )}

            <div className="rounded border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft space-y-1.5">
              <div className="font-medium text-ink">
                קיצור דרך באייפון (שיתוף מוואטסאפ)
              </div>
              <ol className="list-decimal ps-5 space-y-1">
                <li>פותחים את אפליקציית ״קיצורי דרך״ (Shortcuts) → קיצור חדש</li>
                <li>
                  מוסיפים פעולה ״Get Contents of URL״ עם הכתובת שלמעלה, שיטה
                  POST, ו-Request Body מסוג JSON עם שדה message שמקבל את
                  ״Shortcut Input״
                </li>
                <li>
                  בהגדרות הקיצור מפעילים ״Show in Share Sheet״ ובוחרים סוג קלט
                  Text
                </li>
                <li>
                  מעכשיו: לוחצים לחיצה ארוכה על הודעה בוואטסאפ ← שיתוף ← הקיצור —
                  וההודעה מחכה בעמוד הייבוא
                </li>
              </ol>
            </div>

            <form action={revokeInboxTokenAction}>
              <Button type="submit" variant="ghost" size="sm">
                ביטול המפתח (מנתק את הטופס והקיצור)
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
