"use client";

import { useActionState } from "react";
import { FileCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  issueMorningReceiptAction,
  type MorningReceiptState,
} from "@/server/actions/invoices";

export function MorningReceiptButton({
  invoiceId,
  existingDocUrl,
}: {
  invoiceId: string;
  existingDocUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<MorningReceiptState, FormData>(
    issueMorningReceiptAction,
    null,
  );

  const docUrl = state?.docUrl ?? existingDocUrl;

  if (docUrl) {
    return (
      <a href={docUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" size="sm">
          <ExternalLink className="w-4 h-4" />
          קבלה ב-morning
        </Button>
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <FileCheck className="w-4 h-4" />
          {pending ? "מפיק…" : "הפקת קבלה ב-morning"}
        </Button>
      </form>
      {state?.issued && !state.docUrl && (
        <span className="text-xs text-sage-600">הקבלה הופקה בהצלחה</span>
      )}
      {state?.error && (
        <span className="text-xs text-terracotta-600 max-w-56 text-end">
          {state.error}
        </span>
      )}
    </div>
  );
}
