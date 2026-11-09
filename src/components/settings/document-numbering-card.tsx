"use client";

import { startTransition, useActionState } from "react";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOC_KINDS, type DocKind } from "@/lib/billing-docs";
import { MAX_DOC_NUMBER, NEXT_NUMBER_FIELDS } from "@/lib/document-look";
import { updateDocumentNumberingAction, type SettingsFormState } from "@/server/actions/settings";

/**
 * Settings → הגדרות מסמכים → "מספור מסמכים": per document type, the number the
 * next document will get once the app issues documents. Many practices didn't
 * start from 1, so it continues from where the old system stopped.
 */
export function DocumentNumberingCard({
  kinds,
  numbers,
}: {
  /** the types this business issues (an exempt one: receipts only) */
  kinds: DocKind[];
  numbers: Record<DocKind, number>;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateDocumentNumberingAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-sage-600" />
          מספור מסמכים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          <p className="text-sm text-ink-muted">
            המספר של המסמך הבא מכל סוג, כשההפקה מתוך האפליקציה תהיה זמינה. אם המספור התחיל
            במערכת אחרת, ממשיכים מהמספר הבא שלה.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {kinds.map((k) => {
              const field = NEXT_NUMBER_FIELDS[k];
              const error = fieldErr[field]?.[0];
              return (
                <div key={k}>
                  <Label htmlFor={field}>{DOC_KINDS[k].label}: המספר של המסמך הבא</Label>
                  <Input
                    id={field}
                    name={field}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_DOC_NUMBER}
                    step={1}
                    dir="ltr"
                    required
                    defaultValue={numbers[k]}
                    className="text-right"
                    invalid={!!error}
                    aria-describedby={error ? `${field}-error` : undefined}
                  />
                  {error && (
                    <p id={`${field}-error`} role="alert" className="text-xs text-terracotta-600 mt-1">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <ul className="text-xs text-ink-muted space-y-1 list-disc ps-4">
            <li>את מספר ההתחלה של כל סוג מסמך אפשר לקבוע רק עד שמופק המסמך הראשון מסוג זה.</li>
            <li>אחרי שמסמך הופק, אי אפשר לשנות את המספר שלו.</li>
            <li>המספרים רצים ברצף, בלי דילוגים.</li>
          </ul>
          {state?.error && (
            <p role="alert" className="text-sm text-terracotta-600">
              {state.error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
            {state?.saved && <span className="text-sm text-sage-600">נשמר ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
