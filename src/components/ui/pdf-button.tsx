"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// In the installed PWA there is no browser back button, so navigating to the
// PDF strands the user. There we fetch the file and hand it to the native
// share sheet (view/save/send) which returns to the app when dismissed.
// In a regular browser tab we open it in a new tab.
export function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Opens a file the server sends (PDF, image, document): the share sheet in the
 *  installed app, a new tab otherwise. */
export async function openFile(url: string, fileName: string, type: string): Promise<void> {
  if (isStandaloneApp() && typeof navigator.share === "function") {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: type || blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      // User closed the share sheet — nothing to do
      if (err instanceof Error && err.name === "AbortError") return;
      // Anything else falls through to the regular open
    }
  }

  window.open(url, "_blank", "noopener");
}

export async function openPdf(url: string, fileName: string): Promise<void> {
  await openFile(url, fileName, "application/pdf");
}

export function PdfButton({
  url,
  fileName,
  label = "הורדת PDF",
  variant = "secondary",
  disabled,
}: {
  url: string;
  fileName: string;
  label?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await openPdf(url, fileName);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="w-4 h-4" />
      {busy ? "מכין…" : label}
    </Button>
  );
}
