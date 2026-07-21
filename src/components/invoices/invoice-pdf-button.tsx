"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// In the installed PWA there is no browser back button, so navigating to the
// PDF strands the user. There we fetch the PDF and hand it to the native
// share sheet (view/save/send) which returns to the app when dismissed.
// In a regular browser tab we open the PDF in a new tab as before.
export function InvoicePdfButton({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: number;
}) {
  const [busy, setBusy] = useState(false);

  async function openPdf() {
    const url = `/api/invoices/${invoiceId}/pdf`;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari legacy flag
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (standalone && typeof navigator.share === "function") {
      setBusy(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const file = new File(
          [blob],
          `invoice-${String(invoiceNumber).padStart(4, "0")}.pdf`,
          { type: "application/pdf" },
        );
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch (err) {
        // User closed the share sheet — nothing to do
        if (err instanceof Error && err.name === "AbortError") return;
        // Anything else falls through to the regular open
      } finally {
        setBusy(false);
      }
    }

    window.open(url, "_blank", "noopener");
  }

  return (
    <Button variant="secondary" size="sm" onClick={openPdf} disabled={busy}>
      <Download className="w-4 h-4" />
      {busy ? "מכין…" : "הורדת PDF"}
    </Button>
  );
}
