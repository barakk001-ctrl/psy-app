"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { CheckCircle2, Clock, Paperclip, Send, ShieldAlert, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_LABEL,
  attachmentMetaError,
} from "@/lib/support-request";
import {
  submitSupportRequestAction,
  type SupportFormState,
} from "@/server/actions/support";

export type SupportUser = { name: string; email: string; phone: string | null };

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-xs text-terracotta-600 mt-1">
      {messages[0]}
    </p>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * "פנייה לתמיכה". Submits by hand (onSubmit → startTransition) so a refused
 * send keeps everything typed. Nothing is added automatically except the type
 * of page it was sent from (ids stripped on the server).
 */
export function SupportForm({
  user,
  pagePath,
  onDone,
}: {
  user: SupportUser;
  pagePath: string;
  /** "פנייה נוספת" after a successful send */
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    submitSupportRequestAction,
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const fe = state?.fieldErrors ?? {};

  if (state?.done) {
    const ok = state.done.emailed;
    return (
      <div className="py-8 px-2 text-center space-y-4" role="status" aria-live="polite">
        <div
          className={cn(
            "mx-auto w-14 h-14 rounded-full flex items-center justify-center",
            ok ? "bg-sage-100 text-sage-700" : "bg-cream-200 text-terracotta-600",
          )}
        >
          {ok ? <CheckCircle2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
        </div>
        <h3 className="font-display text-xl text-ink">
          {ok ? "תודה!" : "הפנייה נשמרה"}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed max-w-xs mx-auto">
          {state.done.message}
        </p>
        <Button type="button" variant="secondary" onClick={onDone}>
          פנייה נוספת
        </Button>
      </div>
    );
  }

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      setFileError(null);
      return;
    }
    const err = attachmentMetaError({ name: f.name, type: f.type, size: f.size });
    if (err) {
      setFileError(err);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFileError(null);
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (fileError) return;
        const fd = new FormData(e.currentTarget);
        if (!file) fd.delete("attachment");
        startTransition(() => formAction(fd));
      }}
    >
      <div className="flex gap-2.5 rounded-xl bg-sage-50 border border-sage-100 p-3 text-[13px] text-sage-700 leading-relaxed">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <p>
          <strong className="font-semibold">שמירה על פרטיות:</strong> אין לכתוב בפנייה שמות או
          פרטים מזהים של מטופלים. אם מצרפים צילום מסך — כדאי לוודא שלא מופיעים בו פרטי מטופלים.
        </p>
      </div>

      <input type="hidden" name="pagePath" value={pagePath} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="support-name">שם</Label>
          <Input
            id="support-name"
            name="name"
            defaultValue={user.name}
            autoComplete="name"
            invalid={!!fe.name}
            aria-describedby={fe.name ? "support-name-err" : undefined}
            required
          />
          <FieldError id="support-name-err" messages={fe.name} />
        </div>
        <div>
          <Label htmlFor="support-phone">
            טלפון <span className="text-ink-subtle font-normal">(לא חובה)</span>
          </Label>
          <Input
            id="support-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={user.phone ?? ""}
            autoComplete="tel"
            invalid={!!fe.phone}
            aria-describedby={fe.phone ? "support-phone-err" : undefined}
          />
          <FieldError id="support-phone-err" messages={fe.phone} />
        </div>
      </div>

      <div>
        <Label htmlFor="support-email">אימייל לחזרה</Label>
        <Input
          id="support-email"
          name="email"
          type="email"
          defaultValue={user.email}
          autoComplete="email"
          invalid={!!fe.email}
          aria-describedby={fe.email ? "support-email-err" : undefined}
          required
        />
        <FieldError id="support-email-err" messages={fe.email} />
      </div>

      <div>
        <Label htmlFor="support-subject">נושא</Label>
        <Input
          id="support-subject"
          name="subject"
          placeholder="למשל: לא מצליחה להוריד קבלה"
          maxLength={120}
          invalid={!!fe.subject}
          aria-describedby={fe.subject ? "support-subject-err" : undefined}
          required
        />
        <FieldError id="support-subject-err" messages={fe.subject} />
      </div>

      <div>
        <Label htmlFor="support-message">תיאור</Label>
        <Textarea
          id="support-message"
          name="message"
          rows={5}
          maxLength={5000}
          placeholder="מה ניסית לעשות, ומה קרה? אם הופיעה הודעת שגיאה — מה היה כתוב בה."
          className={cn(fe.message && "border-terracotta-500")}
          aria-invalid={!!fe.message}
          aria-describedby={fe.message ? "support-message-err" : undefined}
          required
        />
        <FieldError id="support-message-err" messages={fe.message} />
      </div>

      <div>
        <input
          ref={fileRef}
          id="support-attachment"
          name="attachment"
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          aria-describedby="support-attachment-hint"
        />
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-cream-300 bg-white/70 p-2">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-12 h-12 rounded-lg object-cover bg-cream-200" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate" dir="auto">
                {file.name}
              </div>
              <div className="text-xs text-ink-muted">{formatSize(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
              aria-label="הסרת הקובץ המצורף"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="support-attachment"
            className="flex items-center gap-2 w-full rounded-xl border border-dashed border-cream-400 px-3.5 py-3 text-sm text-ink-soft cursor-pointer hover:border-sage-500 hover:text-sage-700 hover:bg-sage-50/60 transition-colors focus-within:ring-2 focus-within:ring-sage-500"
          >
            <Paperclip className="w-4 h-4" aria-hidden />
            צירוף צילום מסך
            <span className="text-ink-subtle text-xs ms-auto">לא חובה</span>
          </label>
        )}
        <p id="support-attachment-hint" className="text-xs text-ink-subtle mt-1">
          תמונה בלבד (PNG, JPG, HEIC), עד {MAX_ATTACHMENT_LABEL}.
        </p>
        {(fileError || fe.attachment) && (
          <p className="text-xs text-terracotta-600 mt-1" role="alert">
            {fileError ?? fe.attachment?.[0]}
          </p>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-terracotta-600 bg-terracotta-500/10 rounded-xl px-3 py-2" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Send className="w-4 h-4 -scale-x-100" aria-hidden />
        {pending ? "שולח…" : "שליחת הפנייה"}
      </Button>
    </form>
  );
}
