"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DEFAULT_SESSION_MINUTES, addMinutesToTime } from "@/lib/session-duration";
import { useOverlapWarning } from "@/components/sessions/use-overlap-warning";
import { ApplyScopeChoice } from "@/components/sessions/apply-scope-choice";
import { DeleteSessionChoice } from "@/components/sessions/delete-session-choice";
import {
  quickEditSessionAction,
  sessionScopeInfoAction,
  type QuickEditState,
  type SessionScopeInfo,
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
};

export function QuickEditDialog({
  data,
  clients,
  meetingTypes,
  defaultMinutes = DEFAULT_SESSION_MINUTES,
  onClose,
}: {
  data: QuickEditData;
  clients: { id: string; name: string }[];
  meetingTypes: string[];
  /** The practitioner's default meeting length, from settings. */
  defaultMinutes?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<QuickEditState, FormData>(
    quickEditSessionAction,
    null,
  );
  const [cancelled, setCancelled] = useState(data.cancelled);
  const [endTime, setEndTime] = useState(data.endTime);
  const [date, setDate] = useState(data.date);
  const [startTime, setStartTime] = useState(data.startTime);
  const [scope, setScope] = useState<"single" | "future">("single");
  // The client's other meetings (same standing slot / future ones), fetched on
  // open: they decide whether "all of this client's meetings" is offered
  const [info, setInfo] = useState<SessionScopeInfo | null>(null);
  useEffect(() => {
    let stale = false;
    sessionScopeInfoAction(data.id)
      .then((res) => {
        if (!stale) setInfo(res);
      })
      .catch(() => {
        // offline: only "this meeting" is offered
      });
    return () => {
      stale = true;
    };
  }, [data.id]);
  const timeChanged =
    date !== data.date || startTime !== data.startTime || endTime !== data.endTime;
  const offerScope = timeChanged && !!info && info.followers > 0;
  const appliedScope = offerScope ? scope : "single";
  // Checked live, so a clash shows up before "שמירה" — including where the
  // following meetings would land; a cancelled meeting can't clash
  const overlap = useOverlapWarning(
    date && startTime ? `${date}T${startTime}` : undefined,
    date && endTime ? `${date}T${endTime}` : undefined,
    data.id,
    !cancelled,
    appliedScope,
  );

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
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto glass rounded-3xl border border-cream-200/80 shadow-lift p-6 space-y-5">
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

        <form
          // By hand, not `action`: React clears uncontrolled fields after an
          // action, so a refused save lost the new date and time.
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="space-y-4"
        >
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
              <Input
                id="qeDate"
                name="date"
                type="date"
                defaultValue={data.date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="qeStart">התחלה</Label>
              <Input
                id="qeStart"
                name="startTime"
                type="time"
                defaultValue={data.startTime}
                required
                // the end follows the start by the default length; still editable
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (e.target.value) setEndTime(addMinutesToTime(e.target.value, defaultMinutes));
                }}
              />
            </div>
            <div>
              <Label htmlFor="qeEnd">סיום</Label>
              <Input
                id="qeEnd"
                name="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {offerScope && (
            <ApplyScopeChoice
              value={scope}
              onChange={setScope}
              clientName={info!.clientName}
              slotLabel={info!.slotLabel}
              followers={info!.followers}
            />
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

          {state?.error && !state.conflict && (
            <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">{state.error}</div>
          )}

          {(overlap || state?.conflict) && (
            <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600 space-y-2">
              <p>
                {overlap
                  ? `שימו לב: הזמן חופף לפגישה קיימת — ${overlap}.`
                  : state?.error}
              </p>
              <label className="flex items-center gap-2 text-ink-soft">
                <input
                  type="checkbox"
                  name="allowOverlap"
                  className="h-4 w-4 rounded border-cream-300 accent-sage-600"
                />
                אפשר חפיפה ושמור בכל זאת
              </label>
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

        <div className="border-t border-cream-200 pt-3">
          <DeleteSessionChoice
            sessionId={data.id}
            clientId={data.clientId}
            info={info}
            variant="dialog"
          />
        </div>
      </div>
    </div>
  );
}
