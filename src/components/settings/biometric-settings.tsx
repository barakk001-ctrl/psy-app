"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  clearBioLock,
  isBioLockEnabled,
  isWebAuthnAvailable,
  registerBioLock,
} from "@/lib/biometric";

export function BiometricSettings({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isWebAuthnAvailable());
    setEnabled(isBioLockEnabled());
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    const result = await registerBioLock({ email: userEmail, name: userName });
    setBusy(false);
    if (result.ok) {
      setEnabled(true);
    } else {
      setError(result.error ?? "הרישום נכשל");
    }
  }

  function disable() {
    clearBioLock();
    setEnabled(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>נעילה ביומטרית</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          נעילת האפליקציה עם Face ID / Touch ID במכשיר הזה. בכל פתיחה של
          האפליקציה יידרש אימות ביומטרי לפני הצגת המידע. הנעילה היא לכל מכשיר
          בנפרד, וניתן תמיד להתנתק ולהיכנס מחדש עם הסיסמה.
        </p>

        {!supported ? (
          <p className="text-sm text-ink-subtle">
            הדפדפן או המכשיר הזה לא תומכים באימות ביומטרי.
          </p>
        ) : enabled ? (
          <div className="flex items-center justify-between rounded border border-sage-100 bg-sage-50 px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-sm text-sage-700">
              <ScanFace className="w-4 h-4" />
              נעילה ביומטרית פעילה במכשיר זה
            </span>
            <Button variant="ghost" size="sm" onClick={disable}>
              כיבוי
            </Button>
          </div>
        ) : (
          <Button onClick={enable} disabled={busy} variant="secondary">
            <ScanFace className="w-4 h-4" />
            {busy ? "ממתין לאימות…" : "הפעלת נעילה עם Face ID"}
          </Button>
        )}

        {error && <p className="text-sm text-terracotta-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
