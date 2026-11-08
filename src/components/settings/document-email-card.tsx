"use client";

import { startTransition, useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  EMAIL_BODY_MAX,
  EMAIL_PLACEHOLDERS,
  EMAIL_SUBJECT_MAX,
  fillEmailTemplate,
} from "@/lib/document-look";
import { updateDocumentEmailAction, type SettingsFormState } from "@/server/actions/settings";

/**
 * Settings → הגדרות מסמכים → "מייל ללקוח": the subject and message that will
 * go with a document, with a preview filled with example values. Nothing is
 * sent yet: sending comes with issuing from the app.
 */
export function DocumentEmailCard({
  subject: initialSubject,
  body: initialBody,
  businessName,
}: {
  subject: string;
  body: string;
  businessName: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(updateDocumentEmailAction, null);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const example = {
    client: "לקוח/ה לדוגמה",
    docType: "קבלה",
    number: "20017",
    amount: "₪450.00",
    business: businessName || "שם העסק",
  };
  const fieldErr = state?.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-sage-600" />
          מייל ללקוח/ה
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
            הנושא וההודעה שיישלחו עם המסמך. השליחה במייל תתאפשר יחד עם ההפקה מתוך האפליקציה.
          </p>
          <div>
            <Label htmlFor="docEmailSubject">נושא</Label>
            <Input
              id="docEmailSubject"
              name="docEmailSubject"
              value={subject}
              maxLength={EMAIL_SUBJECT_MAX}
              onChange={(e) => setSubject(e.target.value)}
              invalid={!!fieldErr.docEmailSubject}
            />
          </div>
          <div>
            <Label htmlFor="docEmailBody">הודעה</Label>
            <Textarea
              id="docEmailBody"
              name="docEmailBody"
              rows={7}
              value={body}
              maxLength={EMAIL_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={!!fieldErr.docEmailBody || undefined}
              aria-describedby="docEmail-placeholders"
            />
            <p id="docEmail-placeholders" className="text-xs text-ink-muted mt-1">
              אפשר לשלב: {Object.values(EMAIL_PLACEHOLDERS).join(" · ")}. הם יוחלפו בפרטי המסמך.
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-sage-600 hover:underline"
            onClick={() => {
              setSubject(DEFAULT_EMAIL_SUBJECT);
              setBody(DEFAULT_EMAIL_BODY);
            }}
          >
            החזרה לנוסח ברירת המחדל
          </button>

          <section aria-label="תצוגה מקדימה של המייל" className="rounded-2xl border border-cream-300 bg-white overflow-hidden">
            <div className="border-b border-cream-200 bg-cream-100 px-4 py-2 text-xs text-ink-muted space-y-0.5">
              <div>
                <span className="text-ink-subtle">מאת: </span>
                {example.business}
              </div>
              <div>
                <span className="text-ink-subtle">אל: </span>
                <span dir="ltr">client@example.com</span>
              </div>
              <div className="text-sm text-ink font-medium pt-1">{fillEmailTemplate(subject, example) || "—"}</div>
            </div>
            <div className="px-4 py-4 text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
              {fillEmailTemplate(body, example)}
            </div>
            <div className="px-4 pb-4">
              <span className="inline-block rounded-lg bg-sage-600 px-4 py-2 text-sm text-white">צפייה במסמך</span>
            </div>
          </section>

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
