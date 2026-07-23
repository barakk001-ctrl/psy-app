"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { ShieldCheck, ShieldOff, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTotpEnrollmentAction,
  disableTotpAction,
  regenerateBackupCodesAction,
  startTotpEnrollmentAction,
  type TotpEnrollState,
} from "@/server/actions/two-factor";

function BackupCodesBox({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 p-4 space-y-2">
      <p className="text-sm font-medium text-ink">
        קודי גיבוי חד-פעמיים — שמרו אותם עכשיו!
      </p>
      <p className="text-xs text-ink-muted">
        כל קוד עובד פעם אחת במקום קוד האימות (למשל אם הטלפון אבד). הם מוצגים{" "}
        <b>פעם אחת בלבד</b> — צלמו מסך או העתיקו למקום בטוח.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1" dir="ltr">
        {codes.map((c) => (
          <code
            key={c}
            className="rounded-lg bg-white border border-cream-300 px-2 py-1.5 text-center text-sm tracking-wider"
          >
            {c}
          </code>
        ))}
      </div>
    </div>
  );
}

export function TwoFactorSettings({
  enabled,
  backupCount,
}: {
  enabled: boolean;
  backupCount: number;
}) {
  const [startState, startAction, startPending] = useActionState<
    TotpEnrollState,
    FormData
  >(startTotpEnrollmentAction, null);
  const [confirmState, confirmAction, confirmPending] = useActionState<
    TotpEnrollState,
    FormData
  >(confirmTotpEnrollmentAction, null);
  const [disableState, disableAction, disablePending] = useActionState<
    TotpEnrollState,
    FormData
  >(disableTotpAction, null);
  const [regenState, regenAction, regenPending] = useActionState<
    TotpEnrollState,
    FormData
  >(regenerateBackupCodesAction, null);

  const isEnabled = (enabled || confirmState?.enabled) && !disableState?.disabled;
  const enrolling = !isEnabled && !!startState?.qrDataUrl && !confirmState?.enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>אימות דו-שלבי (2FA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-ink-muted leading-relaxed">
          שכבת הגנה נוספת על החשבון: בכל התחברות ממכשיר חדש יידרש, בנוסף לסיסמה,
          קוד מתחלף מאפליקציית אימות (Google Authenticator, סיסמאות של Apple
          וכדומה).
        </p>

        {isEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded border border-sage-100 bg-sage-50 px-4 py-2.5 text-sm text-sage-700">
              <ShieldCheck className="w-4 h-4" />
              אימות דו-שלבי פעיל בחשבון
            </div>

            {confirmState?.backupCodes && (
              <BackupCodesBox codes={confirmState.backupCodes} />
            )}
            {regenState?.backupCodes && <BackupCodesBox codes={regenState.backupCodes} />}

            <div className="rounded-xl border border-cream-300 bg-cream-100 px-4 py-3 space-y-3">
              <p className="text-sm text-ink-soft">
                קודי גיבוי שנותרו:{" "}
                <b>{regenState?.backupCodes ? 5 : backupCount}</b> מתוך 5
              </p>
              <form action={regenAction} className="flex items-end gap-3">
                <div className="flex-1 max-w-40">
                  <Label htmlFor="regenCode">קוד אימות ליצירה מחדש</Label>
                  <Input
                    id="regenCode"
                    name="code"
                    inputMode="numeric"
                    maxLength={6}
                    dir="ltr"
                    placeholder="123456"
                    className="text-center"
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm" disabled={regenPending}>
                  {regenPending ? "יוצר…" : "קודים חדשים"}
                </Button>
              </form>
              {regenState?.error && (
                <p className="text-sm text-terracotta-600">{regenState.error}</p>
              )}
            </div>

            <form action={disableAction} className="flex items-end gap-3">
              <div className="flex-1 max-w-40">
                <Label htmlFor="disableCode">קוד לביטול</Label>
                <Input
                  id="disableCode"
                  name="code"
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  placeholder="123456"
                  className="text-center"
                />
              </div>
              <Button type="submit" variant="ghost" size="sm" disabled={disablePending}>
                <ShieldOff className="w-4 h-4" />
                {disablePending ? "מבטל…" : "כיבוי"}
              </Button>
            </form>
            {disableState?.error && (
              <p className="text-sm text-terracotta-600">{disableState.error}</p>
            )}
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-cream-300 bg-white p-5">
              <img
                src={startState!.qrDataUrl}
                alt="QR לסריקה באפליקציית אימות"
                width={200}
                height={200}
              />
              <p className="text-xs text-ink-muted text-center">
                סרקו באפליקציית האימות, או הזינו ידנית את המפתח:
              </p>
              <code
                dir="ltr"
                className="text-xs bg-cream-100 border border-cream-300 rounded-lg px-3 py-1.5 break-all text-center"
              >
                {startState!.manualKey}
              </code>
            </div>
            <form action={confirmAction} className="flex items-end gap-3">
              <div className="flex-1 max-w-40">
                <Label htmlFor="confirmCode">הקוד שמוצג באפליקציה</Label>
                <Input
                  id="confirmCode"
                  name="code"
                  inputMode="numeric"
                  maxLength={6}
                  dir="ltr"
                  placeholder="123456"
                  className="text-center"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={confirmPending}>
                {confirmPending ? "מאמת…" : "אישור והפעלה"}
              </Button>
            </form>
            {confirmState?.error && (
              <p className="text-sm text-terracotta-600">{confirmState.error}</p>
            )}
          </div>
        ) : (
          <form action={startAction}>
            <Button type="submit" variant="secondary" disabled={startPending}>
              <QrCode className="w-4 h-4" />
              {startPending ? "מכין…" : "הפעלת אימות דו-שלבי"}
            </Button>
            {startState?.error && (
              <p className="text-sm text-terracotta-600 mt-2">{startState.error}</p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
