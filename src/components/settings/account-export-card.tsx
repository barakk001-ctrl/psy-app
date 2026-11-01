"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FolderDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isStandaloneApp } from "@/components/ui/pdf-button";
import { ReauthField } from "@/components/settings/reauth-field";
import { prepareAccountExportAction } from "@/server/actions/account";
import type { ReauthMethod } from "@/lib/reauth";

const EXPORT_MESSAGES: Record<string, string> = {
  expired: "תוקף האישור פג — ממלאים שוב ומורידים.",
  busy: "הורדה אחרת עדיין רצה — נסו שוב בעוד כמה דקות.",
  failed: "ההורדה נכשלה — נסו שוב, ואם זה חוזר כתבו לתמיכה.",
};

const FILE_NAME = "mirpaa-export.zip";

/** A browser saves a form post with an attachment straight to disk, however large. */
function downloadByForm(grant: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/account/export";
  form.style.display = "none";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "grant";
  input.value = grant;
  form.append(input);
  document.body.append(form);
  form.submit();
  form.remove();
}

/** The installed app can't leave its window: fetch it, then the share sheet saves it. */
async function fetchForShare(grant: string): Promise<File> {
  const body = new FormData();
  body.set("grant", grant);
  const res = await fetch("/api/account/export", { method: "POST", body, credentials: "same-origin" });
  if (!res.ok || !res.headers.get("content-type")?.includes("zip")) throw new Error("export");
  return new File([await res.blob()], FILE_NAME, { type: "application/zip" });
}

export function AccountExportCard({
  method,
  email,
  message,
}: {
  method: ReauthMethod;
  email: string;
  /** ?export= on return from a refused download */
  message?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(message ? (EXPORT_MESSAGES[message] ?? null) : null);
  const [started, setStarted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    setStarted(false);
    start(async () => {
      const res = await prepareAccountExportAction(data);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      formRef.current?.reset();
      if (isStandaloneApp() && typeof navigator.share === "function") {
        try {
          setFile(await fetchForShare(res.grant));
        } catch {
          setError(EXPORT_MESSAGES.failed);
        }
        return;
      }
      downloadByForm(res.grant);
      setStarted(true);
    });
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(EXPORT_MESSAGES.failed);
    }
    setFile(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderDown className="w-5 h-5 text-sage-600" />
          הורדת כל הנתונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-soft leading-relaxed">
          קובץ ZIP אחד עם כל מה שבחשבון: לקוחות, פגישות, סיכומים, מסמכים וקבצים, תשלומים וחשבוניות.
          הקובץ <strong>לא מוצפן</strong>, ולכן כדאי לשמור אותו במקום מאובטח. בחשבון גדול ההכנה עשויה
          לקחת כמה דקות.
        </p>
        {file ? (
          <Button type="button" onClick={share}>
            <Share2 className="w-4 h-4" />
            הקובץ מוכן — שמירה
          </Button>
        ) : (
          <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
            <ReauthField method={method} email={email} id="export-reauth" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-terracotta-600" role="alert">
                {error}
              </span>
              <Button type="submit" size="sm" disabled={pending}>
                <Download className="w-4 h-4" />
                {pending ? "מכין…" : "הורדה"}
              </Button>
            </div>
            {started && <p className="text-xs text-sage-700">ההורדה התחילה. הקובץ יופיע בהורדות של הדפדפן.</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
