"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveNoteAction, type NoteFormState } from "@/server/actions/notes";
import { isNoteDirty, noteDraftToKeep } from "@/lib/note-dirty";
import { AUTOSAVE_TICK_MS, autosaveDue } from "@/lib/note-autosave";
import { isLeavingPage } from "@/lib/unsaved-work";
import { useUnsavedWork } from "@/components/security/use-unsaved-work";

type Status =
  | { kind: "idle" }
  | { kind: "saving"; auto: boolean }
  | { kind: "saved"; at: string; auto: boolean }
  | { kind: "failed"; error: string }
  | { kind: "conflict"; currentVersion: string };

/**
 * The session summary. Saves on "שמירת סיכום", and on its own about a minute
 * after the text starts to change (then every minute while writing), when the
 * page is hidden or left, and before an automatic sign-out. Every save is the
 * normal encrypted, audit-logged save, and carries the version the text is
 * based on: if another tab or device saved meanwhile, nothing is overwritten
 * and saving stops until a choice is made here. Nothing clinical is ever kept
 * in browser storage.
 */
export function NoteEditor({
  sessionId,
  initialContent,
  initialVersion,
  readable = true,
}: {
  sessionId: string;
  initialContent: string;
  /** The note's version as the page read it ("" when there is none) */
  initialVersion: string;
  /** False when the stored note couldn't be decrypted: never save over it on its own */
  readable?: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Kept in refs as well, so the timer, unmount and page-hide handlers always
  // see the latest. "Saved" moves forward on every successful save, to exactly
  // the text that was sent (text typed while saving stays unsaved).
  const contentRef = useRef(initialContent);
  const savedRef = useRef(initialContent);
  const versionRef = useRef(initialVersion);
  const savingRef = useRef(false);
  const dirtySinceRef = useRef<number | null>(null);
  const failedAtRef = useRef<number | null>(null);
  const blockedRef = useRef(!readable);
  const [saved, setSaved] = useState(initialContent);

  const dirty = isNoteDirty(content, saved);

  const save = useCallback(
    async (opts: { auto: boolean; text?: string; overwrite?: string }): Promise<boolean> => {
      if (savingRef.current) return false;
      const text = opts.text ?? contentRef.current;
      savingRef.current = true;
      setStatus({ kind: "saving", auto: opts.auto });
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("content", text);
      formData.set("baseVersion", opts.overwrite ?? versionRef.current);
      if (opts.auto) formData.set("auto", "1");
      let result: NoteFormState;
      try {
        result = await saveNoteAction(null, formData);
      } catch {
        result = { error: "אין חיבור, הסיכום לא נשמר." };
      }
      savingRef.current = false;
      if (result?.saved) {
        savedRef.current = text;
        setSaved(text);
        versionRef.current = result.version ?? "";
        failedAtRef.current = null;
        // What is stored now is this text: saving on its own is safe again
        blockedRef.current = false;
        // Typed while saving: the next automatic save counts from now
        dirtySinceRef.current = isNoteDirty(contentRef.current, text) ? Date.now() : null;
        setStatus({ kind: "saved", at: result.savedAt ?? "", auto: opts.auto });
        return true;
      }
      if (result?.conflict) {
        blockedRef.current = true;
        setStatus({ kind: "conflict", currentVersion: result.currentVersion ?? "" });
        return false;
      }
      failedAtRef.current = Date.now();
      setStatus({ kind: "failed", error: result?.error ?? "השמירה נכשלה." });
      return false;
    },
    [sessionId],
  );

  function onChange(text: string) {
    contentRef.current = text;
    setContent(text);
    if (!isNoteDirty(text, savedRef.current)) dirtySinceRef.current = null;
    else if (dirtySinceRef.current === null) dirtySinceRef.current = Date.now();
  }

  /** What may be saved without a press: never an emptied textarea (that deletes the note). */
  const keepable = () =>
    blockedRef.current ? null : noteDraftToKeep(contentRef.current, savedRef.current);

  // Every few seconds while there is unsaved text: save once it's due
  useEffect(() => {
    if (!dirty) return;
    const id = window.setInterval(() => {
      const due = autosaveDue(
        {
          dirtySince: dirtySinceRef.current,
          saving: savingRef.current,
          blocked: blockedRef.current,
          failedAt: failedAtRef.current,
        },
        Date.now(),
      );
      const text = keepable();
      if (due && text !== null) void save({ auto: true, text });
    }, AUTOSAVE_TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs carry the rest
  }, [dirty, save]);

  // Leaving: switching apps or tabs (the iPhone app may never come back),
  // closing the page, or moving to another page inside the app
  useEffect(() => {
    const flush = () => {
      const text = keepable();
      if (text !== null && !savingRef.current) void save({ auto: true, text });
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // The automatic sign-out saved what it could and must not be stopped
      if (isLeavingPage()) return;
      if (!isNoteDirty(contentRef.current, savedRef.current)) return;
      flush();
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Unmounting = another page of the app: the request still completes
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs carry the rest
  }, [save]);

  // Automatic sign-out after inactivity: warn about the unsaved summary, and
  // save it before signing out. An emptied textarea doesn't count: the note
  // just stays as it was.
  useUnsavedWork(
    "סיכום פגישה",
    // Unsaved text counts even while saving is stopped, so the warning still names it
    () => noteDraftToKeep(contentRef.current, savedRef.current) !== null,
    async () => {
      const text = keepable();
      if (text === null) return false;
      if (savingRef.current) {
        // An automatic save is on its way: wait for it, then save what's left
        for (let i = 0; i < 40 && savingRef.current; i++) await new Promise((r) => setTimeout(r, 200));
        const rest = keepable();
        if (rest === null) return true;
        return save({ auto: true, text: rest });
      }
      return save({ auto: true, text });
    },
  );

  const pending = status.kind === "saving";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ auto: false, text: contentRef.current });
      }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Lock className="w-3.5 h-3.5" />
        <span>תוכן הסיכום מוצפן ברמת היישום (AES-256-GCM)</span>
      </div>

      <Textarea
        name="content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="הצג קליני, התערבויות, צעדים הבאים…"
        aria-describedby="note-status"
        className="font-sans leading-relaxed max-h-64 sm:max-h-none sm:min-h-56 resize-y overflow-y-auto"
      />

      {status.kind === "conflict" && (
        <div
          role="alert"
          className="rounded-xl border border-gold-400 bg-gold-200/40 px-3 py-2.5 text-sm text-ink space-y-2"
        >
          <p>
            הסיכום נשמר בינתיים בחלון או במכשיר אחר, ולכן הטקסט כאן לא נשמר כדי לא לדרוס אותו. השמירה
            האוטומטית הופסקה.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!window.confirm("הטקסט שכתוב כאן יימחק ויוצג הסיכום השמור. להמשיך?")) return;
                blockedRef.current = true;
                savedRef.current = contentRef.current; // nothing to warn about on reload
                window.location.reload();
              }}
            >
              הצגת הסיכום השמור
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void save({ auto: false, text: contentRef.current, overwrite: status.currentVersion })}
            >
              שמירת הטקסט שכאן במקומו
            </Button>
          </div>
        </div>
      )}

      {!readable && status.kind === "idle" && (
        <p role="status" className="text-xs text-terracotta-600">
          לא הצלחנו לפתוח את הסיכום השמור, ולכן הוא לא יישמר כאן אוטומטית. שמירה ידנית תחליף אותו.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div id="note-status" aria-live="polite" className="text-xs text-ink-subtle min-h-5">
          {status.kind === "saving" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              שומר…
            </span>
          )}
          {status.kind === "saved" && !dirty && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              {status.auto ? "נשמר אוטומטית" : "נשמר"}
              {status.at && ` ב-${status.at}`}
            </span>
          )}
          {status.kind === "saved" && dirty && (
            <span>
              נשמר{status.at && ` ב-${status.at}`} · שינויים חדשים יישמרו אוטומטית
            </span>
          )}
          {status.kind === "failed" && (
            <span role="alert" className="inline-flex flex-wrap items-center gap-x-2 text-terracotta-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {status.error}
              <button
                type="button"
                onClick={() => void save({ auto: false, text: contentRef.current })}
                className="underline underline-offset-2 min-h-8"
              >
                ניסיון חוזר
              </button>
            </span>
          )}
          {status.kind === "idle" && dirty && (
            <span>{readable ? "שינויים שלא נשמרו · יישמרו אוטומטית" : "שינויים שלא נשמרו"}</span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending && !status.auto ? "שומר…" : "שמירת סיכום"}
        </Button>
      </div>
    </form>
  );
}
