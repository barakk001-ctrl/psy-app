"use client";

import { useActionState, useState, useRef } from "react";
import { Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveNoteAction, type NoteFormState } from "@/server/actions/notes";

export function NoteEditor({
  sessionId,
  initialContent,
}: {
  sessionId: string;
  initialContent: string;
}) {
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    saveNoteAction,
    null,
  );
  const [content, setContent] = useState(initialContent);
  const initialRef = useRef(initialContent);
  const dirty = content !== initialRef.current;

  // After a successful save, the new "initial" is whatever we just sent
  if (state?.saved && !dirty) {
    initialRef.current = content;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Lock className="w-3.5 h-3.5" />
        <span>תוכן הסיכום מוצפן ברמת היישום (AES-256-GCM)</span>
      </div>

      <Textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        placeholder="הצג קליני, התערבויות, צעדים הבאים…"
        className="font-sans leading-relaxed"
      />

      {state?.error && (
        <div className="text-sm text-terracotta-600">{state.error}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-subtle">
          {state?.saved && !dirty && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              נשמר
            </span>
          )}
          {dirty && <span>שינויים שלא נשמרו</span>}
        </div>
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? "שומר…" : "שמירת סיכום"}
        </Button>
      </div>
    </form>
  );
}
