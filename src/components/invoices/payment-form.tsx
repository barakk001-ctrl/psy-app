"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  recordPaymentAction,
  type PaymentFormState,
} from "@/server/actions/payments";

export function PaymentForm({
  invoiceId,
  defaultAmount,
}: {
  invoiceId: string;
  defaultAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    recordPaymentAction,
    null,
  );

  if (state?.saved && open) {
    setOpen(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" variant="secondary">
        <Plus className="w-4 h-4" /> רישום תשלום
      </Button>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4 p-4 rounded-lg bg-cream-100 border border-cream-300">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="amount">סכום (₪) *</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={defaultAmount > 0 ? defaultAmount.toFixed(2) : ""}
            required
          />
        </div>
        <div>
          <Label htmlFor="paidAt">תאריך תשלום *</Label>
          <Input id="paidAt" name="paidAt" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="method">אמצעי תשלום *</Label>
          <Select id="method" name="method" defaultValue="CASH">
            <option value="CASH">מזומן</option>
            <option value="BIT">ביט</option>
            <option value="BANK_TRANSFER">העברה בנקאית</option>
            <option value="CHECK">המחאה</option>
            <option value="CREDIT_CARD">כרטיס אשראי</option>
            <option value="PAYPAL">PayPal</option>
            <option value="OTHER">אחר</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="reference">אסמכתא</Label>
          <Input
            id="reference"
            name="reference"
            placeholder="מס׳ אסמכתא, 4 ספרות אחרונות וכו׳"
          />
        </div>
      </div>

      {state?.error && (
        <div className="text-sm text-terracotta-600">{state.error}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          ביטול
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </form>
  );
}
