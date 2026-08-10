"use client";

import { useActionState, useState } from "react";
import { Check, ExternalLink, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  saveSessionPaymentAction,
  type SessionPaymentState,
} from "@/server/actions/sessions";
import {
  attachMorningNumberToSessionAction,
  type AttachNumberState,
} from "@/server/actions/morning-docs";

function MorningNumberRow({
  sessionId,
  kind,
  label,
  initialNumber,
  initialUrl,
}: {
  sessionId: string;
  kind: "invoice" | "receipt";
  label: string;
  initialNumber: string | null;
  initialUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<AttachNumberState, FormData>(
    attachMorningNumberToSessionAction,
    null,
  );
  const url = state?.saved ? (state.matchedUrl ?? null) : initialUrl;

  return (
    <div className="space-y-1">
      <Label htmlFor={`morning-${kind}`}>{label}</Label>
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="kind" value={kind} />
        <Input
          id={`morning-${kind}`}
          name="number"
          dir="ltr"
          inputMode="numeric"
          placeholder="20017"
          defaultValue={initialNumber ?? ""}
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "…" : "שמירה"}
        </Button>
      </form>
      <div className="flex items-center gap-3">
        {state?.saved && (
          <span className="text-xs text-sage-600 inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> נשמר
          </span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sage-600 hover:text-sage-700 inline-flex items-center gap-1"
          >
            פתיחה ב-morning <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {state?.error && (
          <span className="text-xs text-terracotta-600">{state.error}</span>
        )}
      </div>
    </div>
  );
}

export function SessionBillingCard({
  sessionId,
  rate,
  payment,
  morning,
}: {
  sessionId: string;
  rate: string | null;
  payment: {
    status: string | null;
    method: string | null;
    amount: string | null;
    note: string | null;
  };
  morning: {
    invoiceNumber: string | null;
    invoiceUrl: string | null;
    receiptNumber: string | null;
    receiptUrl: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<SessionPaymentState, FormData>(
    saveSessionPaymentAction,
    null,
  );
  const [status, setStatus] = useState(payment.status ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-sage-600" />
          תשלום
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="sessionId" value={sessionId} />
          <div>
            <Label htmlFor="paymentStatus">סטטוס תשלום</Label>
            <Select
              id="paymentStatus"
              name="paymentStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">— לא סומן —</option>
              <option value="PAID">שולם</option>
              <option value="UNPAID">טרם שולם</option>
              <option value="EXEMPT">ללא תשלום (למשל פגישה שבוטלה)</option>
            </Select>
          </div>

          {status === "PAID" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="paidAmount">סכום (₪)</Label>
                <Input
                  id="paidAmount"
                  name="paidAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={payment.amount ?? rate ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="paymentMethod">אמצעי תשלום</Label>
                <Select
                  id="paymentMethod"
                  name="paymentMethod"
                  defaultValue={payment.method ?? "BIT"}
                >
                  <option value="BIT">ביט</option>
                  <option value="CASH">מזומן</option>
                  <option value="BANK_TRANSFER">העברה בנקאית</option>
                  <option value="CREDIT_CARD">כרטיס אשראי</option>
                  <option value="CHECK">המחאה</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="OTHER">אחר</option>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="paymentNote">תיאור נוסף</Label>
            <Input
              id="paymentNote"
              name="paymentNote"
              defaultValue={payment.note ?? ""}
              placeholder="לא חובה"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs">
              {state?.saved && (
                <span className="text-sage-600 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> נשמר
                </span>
              )}
              {state?.error && (
                <span className="text-terracotta-600">{state.error}</span>
              )}
            </span>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שומר…" : "שמירת תשלום"}
            </Button>
          </div>
        </form>

        <div className="border-t border-cream-200 pt-4 space-y-3">
          <MorningNumberRow
            sessionId={sessionId}
            kind="invoice"
            label="מספר חשבונית מס (morning)"
            initialNumber={morning.invoiceNumber}
            initialUrl={morning.invoiceUrl}
          />
          <MorningNumberRow
            sessionId={sessionId}
            kind="receipt"
            label="מספר קבלה (morning)"
            initialNumber={morning.receiptNumber}
            initialUrl={morning.receiptUrl}
          />
          <p className="text-xs text-ink-subtle">
            מפיקים ב-morning ורושמים כאן רק את המספרים — אפשר חשבונית מס קודם
            וקבלה אחר כך.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
