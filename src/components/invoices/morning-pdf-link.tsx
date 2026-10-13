"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStandaloneApp } from "@/components/ui/pdf-button";

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * "תצוגה מקדימה ב-morning": asks morning for its own PDF of the document
 * (nothing is issued) and opens it — the share sheet in the installed app, a
 * new tab otherwise (with a link if the browser blocked the tab).
 */
export function MorningPdfPreview({
  load,
  label = "תצוגה מקדימה ב-morning (PDF)",
}: {
  load: () => Promise<{ pdfBase64?: string; error?: string; problems?: string[] }>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await load();
      if (!r.pdfBase64) {
        setError([r.error, ...(r.problems ?? [])].filter(Boolean).join(" ") || "לא התקבל קובץ.");
        return;
      }
      const blob = base64ToBlob(r.pdfBase64);
      if (isStandaloneApp() && typeof navigator.share === "function") {
        const file = new File([blob], "preview.pdf", { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch {
            // closed the sheet
          }
          return;
        }
      }
      const u = URL.createObjectURL(blob);
      setUrl(u);
      window.open(u, "_blank", "noopener");
    } catch {
      setError("אין חיבור — נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size="sm" onClick={run} disabled={busy}>
        <FileSearch className="w-4 h-4" />
        {busy ? "מבקש מ-morning…" : label}
      </Button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700"
        >
          <ExternalLink className="w-3 h-3" /> פתיחת ה-PDF של morning
        </a>
      )}
      {error && <p className="text-xs text-terracotta-600 max-w-sm">{error}</p>}
    </div>
  );
}
