"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { DOCUMENT_ACCEPT } from "@/lib/client-documents";
import { signalActivity } from "@/lib/idle-timeout";
import { cn } from "@/lib/utils";
import { uploadExpenseAction } from "@/server/actions/expenses";

/** Keeps a long upload from counting as idle. */
const KEEP_ALIVE_MS = 20_000;

/** Upload or drag an expense file. One file opens straight in its form. */
export function ExpenseUpload() {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    signalActivity();
    const keepAlive = window.setInterval(signalActivity, KEEP_ALIVE_MS);
    let lastId: string | null = null;
    let done = 0;
    const failed: string[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        try {
          const r = await uploadExpenseAction(fd);
          if ("error" in r) failed.push(`${file.name}: ${r.error}`);
          else {
            lastId = r.id;
            done++;
          }
        } catch {
          failed.push(`${file.name}: אין חיבור — נסו שוב`);
        }
      }
    } finally {
      window.clearInterval(keepAlive);
    }
    if (failed.length === 0 && lastId) {
      window.location.assign(done === 1 ? `/expenses/${lastId}` : "/expenses?view=drafts");
      return;
    }
    setBusy(false);
    setError(failed.join(" · "));
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload([...e.dataTransfer.files]);
        }}
        disabled={busy}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          over ? "border-sage-500 bg-sage-50" : "border-cream-300 bg-white/60 hover:bg-white",
        )}
      >
        {busy ? (
          <Loader2 className="w-6 h-6 mx-auto text-sage-600 animate-spin" />
        ) : (
          <CloudUpload className="w-6 h-6 mx-auto text-sage-600" strokeWidth={1.75} />
        )}
        <div className="font-medium text-ink text-sm mt-2">
          {busy ? "מעלה…" : "העלאת מסמך הוצאה"}
        </div>
        <div className="text-xs text-ink-muted mt-0.5">בוחרים קובץ או גוררים אותו לכאן. PDF, תמונה או Word.</div>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        aria-label="העלאת מסמך הוצאה"
        onChange={(e) => void upload([...(e.target.files ?? [])])}
      />
      {error && (
        <p role="alert" className="text-sm text-terracotta-600 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
