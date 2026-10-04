"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRASH_DAYS } from "@/lib/client-trash";
import {
  clientDeletionPreviewAction,
  purgeClientNowAction,
  restoreClientAction,
  trashClientAction,
  type ClientDeletionPreview,
} from "@/server/actions/clients";

function idForm(clientId: string) {
  const fd = new FormData();
  fd.set("id", clientId);
  return fd;
}

const PANEL =
  "rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2 text-sm text-start";

function ClinicalWarning() {
  return (
    <p className="rounded-lg border border-terracotta-500/40 bg-cream-50 px-3 py-2 text-xs text-ink-soft leading-relaxed">
      <b className="text-ink">שימו לב:</b> בתיק יש סיכומי פגישות או קבצים טיפוליים. ייתכן
      שחלה עליך חובה חוקית לשמור רשומות טיפוליות לתקופה מסוימת — ההחלטה אם למחוק היא
      שלך.
    </p>
  );
}

/**
 * "מחיקת התיק" for an inactive client (client card and the row on the "לא
 * פעילים" tab). Asks in-page with what would be deleted — or explains why the
 * client can't be deleted (tax records) — and moves the client to the recycle
 * bin for 30 days.
 */
export function DeleteClientButton({
  clientId,
  variant = "card",
}: {
  clientId: string;
  variant?: "card" | "row";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ClientDeletionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = () =>
    startTransition(async () => {
      setError(null);
      try {
        setPreview(await clientDeletionPreviewAction(clientId));
      } catch {
        setError("אין חיבור — נסו שוב.");
      }
    });

  const confirm = () =>
    startTransition(async () => {
      const r = await trashClientAction(idForm(clientId));
      if (r?.error) {
        setError(r.error);
        return;
      }
      setPreview(null);
      if (variant === "card") router.push("/clients?view=trash");
      else router.refresh();
    });

  const close = () => {
    setPreview(null);
    setError(null);
  };

  const trigger =
    variant === "card" ? (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-terracotta-600 hover:bg-terracotta-500/10"
        disabled={pending || !!preview}
        onClick={open}
      >
        <Trash2 className="w-4 h-4" />
        {pending && !preview ? "בודק…" : "מחיקת התיק"}
      </Button>
    ) : (
      <div className="pe-3 sm:pe-4">
        <button
          type="button"
          title="מחיקה"
          aria-label="מחיקה"
          disabled={pending || !!preview}
          onClick={open}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-terracotta-600 hover:bg-terracotta-500/10 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden md:inline">מחיקה</span>
        </button>
      </div>
    );

  let panel: React.ReactNode = null;
  if (preview && "error" in preview) {
    panel = (
      <div role="alert" className={PANEL}>
        <p className="text-terracotta-600">{preview.error}</p>
        <Button type="button" size="sm" variant="secondary" onClick={close}>
          חזרה
        </Button>
      </div>
    );
  } else if (preview && !preview.allowed) {
    panel = (
      <div role="alertdialog" aria-label="מחיקת תיק" className={PANEL}>
        <p className="font-medium text-ink">אי אפשר למחוק את {preview.name}</p>
        {preview.active ? (
          <p className="text-ink-soft">
            אפשר למחוק רק לקוח/ה לא פעיל/ה. העבירו קודם ל״לא פעילים״.
          </p>
        ) : (
          <>
            <p className="text-ink-soft">
              בתיק יש {preview.blockers}. רשומות כספיות חייבות להישמר לפי דיני המס, ולכן אי
              אפשר למחוק את התיק.
            </p>
            <p className="text-xs text-ink-muted">
              אפשר פשוט להשאיר אותו ב״לא פעילים״: הוא לא מופיע ביומן ובבחירת מטופלים,
              וההיסטוריה נשמרת.
            </p>
          </>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={close}>
          {preview.active ? "חזרה" : "הבנתי, להשאיר כלא פעיל/ה"}
        </Button>
      </div>
    );
  } else if (preview && preview.allowed) {
    panel = (
      <div role="alertdialog" aria-label="מחיקת תיק" className={PANEL}>
        <p className="font-medium text-ink">למחוק את {preview.name}?</p>
        <p className="text-terracotta-600 font-medium">{preview.contents}</p>
        {preview.clinicalWarning && <ClinicalWarning />}
        <p className="text-xs text-ink-muted leading-relaxed">
          התיק יעבור לסל המחזור ל-{TRASH_DAYS} יום, ועד אז אפשר לשחזר הכול. אחרי {TRASH_DAYS}{" "}
          יום הוא יימחק לצמיתות, אוטומטית. בינתיים הוא לא יופיע בשום מקום, ולא יישלחו
          תזכורות.
        </p>
        {error && <p className="text-terracotta-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" variant="danger" disabled={pending} onClick={confirm}>
            {pending ? "מוחק…" : "מחיקה — העברה לסל המחזור"}
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={close}>
            חזרה
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <>
        {trigger}
        {(panel || error) && (
          <div className="basis-full px-4 sm:px-5 pb-4">
            {panel ?? <p className="text-sm text-terracotta-600">{error}</p>}
          </div>
        )}
      </>
    );
  }
  return (
    <div className="space-y-2">
      {trigger}
      {panel && <div className="w-full sm:w-[24rem]">{panel}</div>}
      {!panel && error && <p className="text-sm text-terracotta-600">{error}</p>}
    </div>
  );
}

/** A row of the recycle bin: שחזור, or מחיקה לצמיתות עכשיו (asks first). */
export function TrashRowActions({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ClientDeletionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof restoreClientAction) =>
    startTransition(async () => {
      setError(null);
      const r = await action(idForm(clientId));
      if (r?.error) {
        setError(r.error);
        return;
      }
      setPreview(null);
      router.refresh();
    });

  const askPurge = () =>
    startTransition(async () => {
      setError(null);
      try {
        setPreview(await clientDeletionPreviewAction(clientId, true));
      } catch {
        setError("אין חיבור — נסו שוב.");
      }
    });

  return (
    <>
      <div className="flex items-center gap-1 pe-3 sm:pe-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(restoreClientAction)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-sage-700 hover:bg-sage-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          שחזור
        </button>
        <button
          type="button"
          disabled={pending || !!preview}
          onClick={askPurge}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-terracotta-600 hover:bg-terracotta-500/10 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">מחיקה לצמיתות עכשיו</span>
          <span className="sm:hidden">מחיקה</span>
        </button>
      </div>
      {(preview || error) && (
        <div className="basis-full px-4 sm:px-5 pb-4">
          {preview && "error" in preview && (
            <p className="text-sm text-terracotta-600">{preview.error}</p>
          )}
          {preview && "allowed" in preview && preview.allowed && (
            <div role="alertdialog" aria-label="מחיקה לצמיתות" className={cn(PANEL, "sm:w-[26rem]")}>
              <p className="font-medium text-ink">למחוק את {preview.name} לצמיתות?</p>
              <p className="text-terracotta-600 font-medium">{preview.contents}</p>
              {preview.clinicalWarning && <ClinicalWarning />}
              <p className="text-xs text-ink-muted">אי אפשר לבטל את זה — גם לא מסל המחזור.</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(purgeClientNowAction)}
                >
                  {pending ? "מוחק…" : "מחיקה לצמיתות"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setPreview(null)}
                >
                  חזרה
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-terracotta-600">{error}</p>}
        </div>
      )}
    </>
  );
}
