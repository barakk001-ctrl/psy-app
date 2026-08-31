"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  deleteSessionAction,
  quickEditSessionAction,
  type QuickEditState,
} from "@/server/actions/sessions";

export type QuickEditData = {
  id: string;
  clientId: string;
  clientName: string;
  date: string; // yyyy-MM-dd (clinic wall clock)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  treatmentType: string;
  cancelled: boolean;
  /** part of a recurring series — offers "apply to all future" on time changes */
  inSeries: boolean;
};

export function QuickEditDialog({
  data,
  clients,
  meetingTypes,
  onClose,
}: {
  data: QuickEditData;
  clients: { id: string; name: string }[];
  meetingTypes: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<QuickEditState, FormData>(
    quickEditSessionAction,
    null,
  );
  const [cancelled, setCancelled] = useState(data.cancelled);

  useEffect(() => {
    if (state?.saved) {
      onClose();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.saved]);

  const typeOptions = meetingTypes.includes(data.treatmentType)
    ? meetingTypes
    : [data.treatmentType, ...meetingTypes];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="עריכת פגישה"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg glass rounded-3xl border border-cream-200/80 shadow-lift p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">עריכת פגישה</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="p-2 -m-2 text-ink-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={data.id} />

          <div>
            <Label htmlFor="qeClient">מטופל/ת</Label>
            <Select id="qeClient" name="clientId" defaultValue={data.clientId}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {!clients.some((c) => c.id === data.clientId) && (
                <option value={data.clientId}>{data.clientName}</option>
              )}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="qeDate">תאריך</Label>
              <Input id="qeDate" name="date" type="date" defaultValue={data.date} required />
            </div>
            <div>
              <Label htmlFor="qeStart">התחלה</Label>
              <Input
                id="qeStart"
                name="startTime"
                type="time"
                defaultValue={data.startTime}
                required
              />
            </div>
            <div>
              <Label htmlFor="qeEnd">סיום</Label>
              <Input
                id="qeEnd"
                name="endTime"
                type="time"
                defaultValue={data.endTime}
                required
              />
            </div>
          </div>

          {data.inSeries && (
            <div className="rounded-xl border border-cream-300 bg-white/60 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-ink-soft">
                על אילו פגישות להחיל את שינוי המועד?
              </p>
              <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
                <input
                  type="radio"
                  name="applyScope"
                  value="single"
                  defaultChecked
                  className="h-4 w-4 accent-sage-600"
                />
                רק הפגישה הזו
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
                <input
                  type="radio"
                  name="applyScope"
                  value="future"
                  className="h-4 w-4 accent-sage-600"
                />
                הפגישה הזו וכל הפגישות הבאות בסדרה
              </label>
              <p className="text-xs text-ink-subtle">
                למשל: פגישה קבועה שעוברת מ-9:00 ל-9:30 — כל הפגישות הבאות יעברו
                לשעה החדשה (וגם ליום אחר בשבוע, אם שיניתם תאריך).
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="qeType">סוג המפגש</Label>
            <Select id="qeType" name="treatmentType" defaultValue={data.treatmentType}>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-cream-300 bg-white/60 px-4 py-3 cursor-pointer">
            <span className="text-sm text-ink-soft">פגישה מבוטלת</span>
            <span className="relative inline-flex">
              <input
                type="checkbox"
                name="cancelled"
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
                className="peer sr-only"
              />
              <span className="w-11 h-6 rounded-full bg-cream-300 peer-checked:bg-terracotta-500 transition-colors" />
              <span className="absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-5" />
            </span>
          </label>

          {state?.error && (
            <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600 space-y-2">
              <p>{state.error}</p>
              {state.conflict && (
                <label className="flex items-center gap-2 text-ink-soft">
                  <input
                    type="checkbox"
                    name="allowOverlap"
                    className="h-4 w-4 rounded border-cream-300 accent-sage-600"
                  />
                  אפשר חפיפה ושמור בכל זאת
                </label>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              חזרה
            </Button>
            <span className="flex-1" />
            <Link
              href={`/sessions/${data.id}`}
              className="text-sm text-sage-600 hover:text-sage-700 inline-flex items-center gap-1"
            >
              לעמוד הפגישה
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </form>

        <form
          action={deleteSessionAction}
          onSubmit={(e) => {
            if (!window.confirm("למחוק את הפגישה לצמיתות? גם הסיכום שלה יימחק.")) {
              e.preventDefault();
            }
          }}
          className="border-t border-cream-200 pt-3"
        >
          <input type="hidden" name="id" value={data.id} />
          <button
            type="submit"
            className="text-sm text-terracotta-600 hover:text-terracotta-500"
          >
            מחיקה לצמיתות
          </button>
        </form>
      </div>
    </div>
  );
}
