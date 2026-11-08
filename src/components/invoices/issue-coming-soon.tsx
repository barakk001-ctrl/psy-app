"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { focusOnAppear } from "@/components/ui/use-dialog-focus";

/**
 * What "הפקת מסמך" shows while the app can't issue documents itself (it needs
 * the Tax Authority's software registration first). Calm, no number is made
 * up: save the draft, issue the document where it is issued today, record
 * its number on the draft's page.
 */
export function IssueComingSoon({
  onSave,
  onClose,
  pending,
  saved = false,
}: {
  /** saves the form as a draft; left out on a draft's own page (already saved) */
  onSave?: () => void;
  onClose: () => void;
  pending?: boolean;
  /** on a saved draft's page: point at the number field below instead */
  saved?: boolean;
}) {
  return (
    <div
      ref={focusOnAppear}
      tabIndex={-1}
      role="status"
      className="rounded-2xl border border-sage-100 bg-sage-50 px-4 py-4 space-y-3 text-sm text-ink-soft leading-relaxed outline-none"
    >
      <p className="flex items-start gap-2 font-medium text-ink">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-sage-600" aria-hidden />
        הפקת מסמכים מתוך האפליקציה תגיע בקרוב.
      </p>
      <p>
        {saved
          ? "בינתיים מפיקים את המסמך במערכת שבה מפיקים היום, ורושמים כאן למטה את מספר המסמך שהופק. כך ההכנסות והחובות נשארים מעודכנים."
          : "בינתיים שומרים כאן טיוטה, מפיקים את המסמך במערכת שבה מפיקים היום, ורושמים בדף הטיוטה את מספר המסמך שהופק. כך ההכנסות והחובות נשארים מעודכנים."}
      </p>
      <div className="flex flex-wrap gap-2">
        {onSave && (
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>
            {pending ? "שומר…" : "שמירת טיוטה"}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          סגירה
        </Button>
      </div>
    </div>
  );
}
