"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendInvoiceEmailAction,
  type SendInvoiceEmailState,
} from "@/server/actions/invoices";

export function SendInvoiceEmailButton({
  invoiceId,
  clientEmail,
}: {
  invoiceId: string;
  clientEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState<SendInvoiceEmailState, FormData>(
    sendInvoiceEmailAction,
    null,
  );

  if (!clientEmail) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <Mail className="w-4 h-4" />
          {pending ? "שולח…" : "שליחה במייל"}
        </Button>
      </form>
      {state?.sent && (
        <span className="text-xs text-sage-600">נשלח אל {clientEmail}</span>
      )}
      {state?.error && (
        <span className="text-xs text-terracotta-600 max-w-56 text-end">{state.error}</span>
      )}
    </div>
  );
}
