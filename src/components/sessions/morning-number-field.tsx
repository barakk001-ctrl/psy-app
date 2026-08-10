"use client";

import { useActionState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  attachMorningNumberToSessionAction,
  type AttachNumberState,
} from "@/server/actions/morning-docs";

export function MorningNumberField({
  sessionId,
  initialNumber,
  initialUrl,
}: {
  sessionId: string;
  initialNumber: string | null;
  initialUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<AttachNumberState, FormData>(
    attachMorningNumberToSessionAction,
    null,
  );

  const url = state?.saved ? (state.matchedUrl ?? null) : initialUrl;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="morningNumber">מספר חשבונית מ-morning</Label>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <Input
          id="morningNumber"
          name="number"
          dir="ltr"
          inputMode="numeric"
          placeholder="20017"
          defaultValue={initialNumber ?? ""}
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </form>
      {state?.saved && (
        <p className="text-xs text-sage-600 inline-flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> נשמר
          {state.matchedUrl && " — נמצא מסמך תואם ב-morning"}
        </p>
      )}
      {state?.error && <p className="text-xs text-terracotta-600">{state.error}</p>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sage-600 hover:text-sage-700 inline-flex items-center gap-1"
        >
          פתיחת המסמך ב-morning <ExternalLink className="w-3 h-3" />
        </a>
      )}
      <p className="text-xs text-ink-subtle">
        הפיקה חשבונית ב-morning? הזיני כאן רק את המספר — והפגישה תקושר אליה.
      </p>
    </div>
  );
}
