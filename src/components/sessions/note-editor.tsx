"use client";

import { useActionState, useState, startTransition } from "react";
import { Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveNoteAction, type NoteFormState } from "@/server/actions/notes";
import { isNoteDirty } from "@/lib/note-dirty";

export function NoteEditor({
  sessionId,
  initialContent,
}: {
  sessionId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  // The last text the server confirmed saving. "Unsaved changes" means the
  // textarea differs from this — it moves forward on every successful save,
  // to exactly the text that was sent (text typed while saving stays dirty).
  const [savedContent, setSavedContent] = useState(initialContent);

  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    async (prev, formData) => {
      const result = await saveNoteAction(prev, formData);
      if (result?.saved) setSavedContent(String(formData.get("content") ?? ""));
      return result;
    },
    null,
  );

  const dirty = isNoteDirty(content, savedContent);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Lock className="w-3.5 h-3.5" />
        <span>תוכן הסיכום מוצפן ברמת היישום (AES-256-GCM)</span>
      </div>

      <Textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="הצג קליני, התערבויות, צעדים הבאים…"
        className="font-sans leading-relaxed max-h-64 sm:max-h-none sm:min-h-56 resize-y overflow-y-auto"
      />

      {state?.error && (
        <div className="text-sm text-terracotta-600">{state.error}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-subtle">
          {state?.saved && !dirty && !pending && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              נשמר
            </span>
          )}
          {dirty && !pending && <span>שינויים שלא נשמרו</span>}
        </div>
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? "שומר…" : "שמירת סיכום"}
        </Button>
      </div>
    </form>
  );
}
