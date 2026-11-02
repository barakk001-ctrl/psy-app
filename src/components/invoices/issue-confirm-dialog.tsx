"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { documentNextNumberAction } from "@/server/actions/documents";

export type IssueSummary = {
  /** "חשבונית מס" */
  label: string;
  /** morning's code for the type, to ask it for the next number */
  code: number;
  sender: string;
  /** "02/11/2026" */
  date: string;
  client: string;
  /** "₪350.00" */
  amount: string;
  emails: string[];
};

/**
 * "אישור הפקת …": the last stop before a document becomes official. The number
 * in the title is what morning says comes next; when it doesn't say, there's no
 * number, and none is ever made up here.
 */
export function IssueConfirmDialog({
  summary,
  pending,
  onConfirm,
  onClose,
}: {
  summary: IssueSummary;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [number, setNumber] = useState<number | null>(null);
  useDialogFocus(true, panelRef, () => {
    if (!pending) onClose();
  });

  useEffect(() => {
    let live = true;
    documentNextNumberAction(String(summary.code))
      .then((r) => {
        if (live) setNumber(r.number);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [summary.code]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-muted shrink-0">{label}</dt>
      <dd className="text-ink text-end min-w-0 break-words">{value}</dd>
    </div>
  );

  // On <body>: inside the page, an ancestor's effects pin `fixed` to it, and the
  // dialog lands off-screen on a scrolled phone
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-title"
        tabIndex={-1}
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-lift p-5 space-y-4"
      >
        <h2 id="issue-title" className="font-display text-xl text-ink">
          אישור הפקת {summary.label}
          {number != null ? ` ${number}` : ""}
        </h2>
        <p className="flex items-start gap-2 rounded-xl border border-gold-400 bg-gold-200/40 px-3 py-2 text-sm text-ink">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          אחרי ההפקה אי אפשר לערוך את המסמך.
        </p>
        <dl className="divide-y divide-cream-200">
          {row("מאת", summary.sender)}
          {row("תאריך המסמך", summary.date)}
          {row("לקוח/ה", summary.client)}
          {row("סכום", summary.amount)}
          {row(
            "נשלח במייל אל",
            summary.emails.length ? (
              <span dir="ltr">{summary.emails.join(", ")}</span>
            ) : (
              "לא נשלח במייל"
            ),
          )}
        </dl>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            חזרה לעריכה
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            <FileCheck className="w-4 h-4" /> {pending ? "מפיק…" : "לאשר ולהפיק"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
