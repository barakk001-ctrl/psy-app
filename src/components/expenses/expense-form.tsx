"use client";

import { useTransition, useRef, useState } from "react";
import { CheckCircle2, FilePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { focusOnAppear } from "@/components/ui/use-dialog-focus";
import { EXPENSE_DOC_TYPES, type ExpenseDetails } from "@/lib/expenses";
import { deleteExpenseAction, saveExpenseAction } from "@/server/actions/expenses";

/** The details below the file. Refused saves keep what was typed (onSubmit, not action=). */
export function ExpenseForm({
  id,
  initial,
  today,
}: {
  id: string;
  initial: ExpenseDetails;
  /** yyyy-mm-dd, where an empty date starts */
  today: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const back = () => window.location.assign("/expenses");

  function run(intent: "approve" | "draft") {
    if (!form.current) return;
    const fd = new FormData(form.current);
    fd.set("intent", intent);
    setError(null);
    setProblems([]);
    start(async () => {
      try {
        const r = await saveExpenseAction(fd);
        if ("error" in r) {
          setError(r.error);
          setProblems(r.problems ?? []);
          return;
        }
        back();
      } catch {
        setError("אין חיבור — ההוצאה לא נשמרה. נסו שוב.");
      }
    });
  }

  function remove() {
    const fd = new FormData();
    fd.set("id", id);
    setError(null);
    start(async () => {
      try {
        const r = await deleteExpenseAction(fd);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        back();
      } catch {
        setError("אין חיבור — ההוצאה לא נמחקה. נסו שוב.");
      }
    });
  }

  return (
    <Card>
      <CardContent>
        <form
          ref={form}
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run("approve");
          }}
        >
          <input type="hidden" name="id" value={id} />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exp-type">סוג המסמך *</Label>
              <Select id="exp-type" name="docType" defaultValue={initial.docType ?? ""}>
                <option value="">בחירת סוג</option>
                {EXPENSE_DOC_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-date">תאריך המסמך *</Label>
              <Input id="exp-date" name="docDate" type="date" defaultValue={initial.docDate || today} />
            </div>
            <div>
              <Label htmlFor="exp-supplier">ספק *</Label>
              <Input id="exp-supplier" name="supplier" defaultValue={initial.supplier} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="exp-number">מספר המסמך</Label>
              <Input id="exp-number" name="docNumber" defaultValue={initial.docNumber} maxLength={40} dir="ltr" className="text-right" />
            </div>
            <div>
              <Label htmlFor="exp-amount">סכום המסמך (₪) *</Label>
              <Input id="exp-amount" name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={initial.amount} />
            </div>
            <div>
              <Label htmlFor="exp-vat">מע״מ מתוך הסכום (₪)</Label>
              <Input id="exp-vat" name="vatAmount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={initial.vatAmount} />
            </div>
          </div>

          {(error || problems.length > 0) && (
            <div role="alert" className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600 space-y-1">
              {error && <p className="font-medium">{error}</p>}
              {problems.length > 0 && (
                <ul className="list-disc ps-5 space-y-0.5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {confirmingDelete ? (
            <div
              ref={focusOnAppear}
              tabIndex={-1}
              className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2"
            >
              <p className="text-sm text-ink">למחוק את ההוצאה ואת הקובץ שלה? אי אפשר לשחזר אותם.</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="danger" onClick={remove} disabled={pending}>
                  {pending ? "מוחק…" : "כן, למחוק"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(true)} disabled={pending}>
                <Trash2 className="w-4 h-4" /> מחיקה
              </Button>
              <Button type="button" variant="secondary" onClick={() => run("draft")} disabled={pending}>
                <FilePen className="w-4 h-4" /> העברה לטיוטה
              </Button>
              <Button type="submit" disabled={pending}>
                <CheckCircle2 className="w-4 h-4" /> {pending ? "שומר…" : "אישור"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
