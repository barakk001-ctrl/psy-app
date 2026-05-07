"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatCurrency } from "@/lib/format";
import {
  createInvoiceAction,
  type InvoiceFormState,
} from "@/server/actions/invoices";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type SessionOption = {
  id: string;
  clientId: string;
  startsAt: string;
  rate: string | null;
};

type CustomItem = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export function InvoiceForm({
  clients,
  sessionsByClient,
  defaults,
}: {
  clients: ClientOption[];
  sessionsByClient: Record<string, SessionOption[]>;
  defaults?: { clientId?: string };
}) {
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(
    createInvoiceAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  const today = new Date().toISOString().slice(0, 10);

  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);

  const sessions = clientId ? sessionsByClient[clientId] ?? [] : [];

  const sessionsTotal = useMemo(() => {
    return sessions
      .filter((s) => selectedSessions.has(s.id))
      .reduce((sum, s) => sum + (s.rate ? parseFloat(s.rate) : 0), 0);
  }, [sessions, selectedSessions]);

  const customTotal = useMemo(() => {
    return customItems.reduce((sum, it) => {
      const q = parseFloat(it.quantity || "0");
      const p = parseFloat(it.unitPrice || "0");
      return sum + (Number.isNaN(q) || Number.isNaN(p) ? 0 : q * p);
    }, 0);
  }, [customItems]);

  const total = sessionsTotal + customTotal;

  function toggleSession(id: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomItem() {
    setCustomItems((prev) => [
      ...prev,
      { description: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function updateCustomItem(idx: number, field: keyof CustomItem, value: string) {
    setCustomItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  }

  function removeCustomItem(idx: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Card>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="clientId">לקוח/ה *</Label>
            <Select
              id="clientId"
              name="clientId"
              required
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSelectedSessions(new Set());
              }}
            >
              <option value="" disabled>
                בחר/י לקוח/ה
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
            {fieldErr.clientId && (
              <p className="text-xs text-terracotta-600 mt-1">{fieldErr.clientId[0]}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">תאריך הפקה *</Label>
              <Input id="issueDate" name="issueDate" type="date" defaultValue={today} required />
            </div>
            <div>
              <Label htmlFor="dueDate">לתשלום עד</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions to bill */}
      {clientId && (
        <Card>
          <CardHeader>
            <CardTitle>פגישות לחיוב</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                אין פגישות לא מחויבות עבור לקוח/ה זה. ניתן להמשיך עם שורות חיוב מותאמות.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200 -mx-5">
                {sessions.map((s) => {
                  const checked = selectedSessions.has(s.id);
                  const rate = s.rate ? parseFloat(s.rate) : 0;
                  return (
                    <li key={s.id}>
                      <label className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-cream-100/60">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSession(s.id)}
                          className="w-4 h-4 accent-sage-600"
                        />
                        {checked && (
                          <input type="hidden" name="sessionIds" value={s.id} />
                        )}
                        <div className="flex-1 text-sm">
                          <div className="text-ink">{formatDateTime(s.startsAt)}</div>
                        </div>
                        <div className="text-sm text-ink-muted">{formatCurrency(rate)}</div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom line items */}
      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle>שורות חיוב נוספות</CardTitle>
            <p className="text-xs text-ink-muted mt-1">
              לדוגמה: פגישת זוגית, ייעוץ טלפוני, חומרים
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addCustomItem}>
            <Plus className="w-4 h-4" /> הוספה
          </Button>
        </CardHeader>
        {customItems.length > 0 && (
          <CardContent className="space-y-3">
            {customItems.map((it, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-start p-3 rounded bg-cream-100"
              >
                <div className="col-span-12 sm:col-span-6">
                  <Label htmlFor={`desc-${idx}`} className="sr-only">תיאור</Label>
                  <Input
                    id={`desc-${idx}`}
                    name={`customItems[${idx}][description]`}
                    placeholder="תיאור"
                    value={it.description}
                    onChange={(e) => updateCustomItem(idx, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Label htmlFor={`qty-${idx}`} className="sr-only">כמות</Label>
                  <Input
                    id={`qty-${idx}`}
                    name={`customItems[${idx}][quantity]`}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="כמות"
                    value={it.quantity}
                    onChange={(e) => updateCustomItem(idx, "quantity", e.target.value)}
                  />
                </div>
                <div className="col-span-7 sm:col-span-3">
                  <Label htmlFor={`price-${idx}`} className="sr-only">מחיר</Label>
                  <Input
                    id={`price-${idx}`}
                    name={`customItems[${idx}][unitPrice]`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="מחיר יחידה"
                    value={it.unitPrice}
                    onChange={(e) => updateCustomItem(idx, "unitPrice", e.target.value)}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => removeCustomItem(idx)}
                    className="text-ink-muted hover:text-terracotta-500 p-1"
                    aria-label="הסר שורה"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="notes">הערות לחשבונית</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="הערות שיופיעו בתחתית החשבונית"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-cream-200">
            <span className="text-ink-muted text-sm">סה״כ</span>
            <span className="font-display text-2xl text-ink">{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Link href="/invoices">
          <Button type="button" variant="ghost">ביטול</Button>
        </Link>
        <Button type="submit" disabled={pending || total <= 0}>
          {pending ? "יוצר…" : "יצירת חשבונית"}
        </Button>
      </div>
    </form>
  );
}
