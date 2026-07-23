"use client";

import { useActionState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitAppointmentRequestAction,
  type RequestFormState,
} from "@/server/actions/inbox";

export function RequestForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(
    submitAppointmentRequestAction,
    null,
  );

  if (state?.sent) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto text-sage-600" />
          <h2 className="font-display text-xl text-ink">הבקשה נשלחה!</h2>
          <p className="text-sm text-ink-muted">ניצור איתך קשר לאישור המועד.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <Card>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">שם מלא *</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="phone">טלפון *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
            />
          </div>
          <div>
            <Label htmlFor="preferred">מועד מועדף</Label>
            <Input
              id="preferred"
              name="preferred"
              placeholder='למשל: יום שלישי ב-16:00, או 15/8 בבוקר'
            />
          </div>
          <div>
            <Label htmlFor="message">הודעה</Label>
            <Textarea id="message" name="message" rows={3} placeholder="לא חובה" />
          </div>

          {state?.error && (
            <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              {state.error}
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            <Send className="w-4 h-4" />
            {pending ? "שולח…" : "שליחת הבקשה"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
