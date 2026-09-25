"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_SESSION_MINUTES,
  DURATION_CHOICES,
  withDuration,
} from "@/lib/session-duration";
import {
  createSessionAction,
  updateSessionAction,
  type SessionFormState,
} from "@/server/actions/sessions";
import { addMinutesLocal, useOverlapWarning } from "./use-overlap-warning";
import { ApplyScopeChoice } from "./apply-scope-choice";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  defaultRate: string | null;
  treatmentType?: string;
};

export type SessionFormInitial = {
  id: string;
  clientId: string;
  startsAt: string; // datetime-local format yyyy-MM-ddTHH:mm
  durationMinutes: number;
  location: "OFFICE" | "ONLINE" | "HOME_VISIT" | "OTHER";
  meetingUrl: string | null;
  rate: string | null;
  treatmentType?: string;
};

export function SessionForm({
  clients,
  defaults,
  initial,
  meetingTypes,
  defaultMinutes = DEFAULT_SESSION_MINUTES,
  scope,
}: {
  clients: ClientOption[];
  defaults?: { startsAt?: string; clientId?: string };
  initial?: SessionFormInitial;
  meetingTypes: string[];
  /** The practitioner's own default meeting length, from settings. */
  defaultMinutes?: number;
  /** Edit only: the client's following meetings in the same standing slot,
   *  offered "all of them" when the date/time changes. */
  scope?: { clientName: string; slotLabel: string; followers: number };
}) {
  const isEdit = !!initial;
  const action = isEdit ? updateSessionAction : createSessionAction;

  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(
    action,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  const [location, setLocation] = useState<string>(
    initial?.location ?? "OFFICE",
  );
  const [clientId, setClientId] = useState<string>(
    initial?.clientId ?? defaults?.clientId ?? "",
  );
  const [recurrence, setRecurrence] = useState<string>("NONE");
  const [seriesMode, setSeriesMode] = useState<string>("COUNT");
  const [treatmentType, setTreatmentType] = useState<string>(
    initial?.treatmentType ?? meetingTypes[0] ?? "טיפול פרטני",
  );
  const typeOptions = meetingTypes.includes(treatmentType)
    ? meetingTypes
    : [treatmentType, ...meetingTypes];

  const selectedClient = clients.find((c) => c.id === clientId);
  const ratePlaceholder = selectedClient?.defaultRate ?? "";

  // Match the start time to the initial value (edit) or the URL param (create from calendar click)
  const startsAtDefault = initial?.startsAt ?? defaults?.startsAt;
  // An existing meeting opens on the length it was saved with; a new one on the
  // practitioner's own default rather than a number baked into the form.
  const [duration, setDuration] = useState<string>(
    String(initial?.durationMinutes ?? defaultMinutes),
  );
  const durationOptions = withDuration(
    withDuration(DURATION_CHOICES, initial?.durationMinutes ?? defaultMinutes),
    defaultMinutes,
  );
  const rateDefault = initial?.rate ?? "";
  // Checked live, so a clash shows up while the time is being chosen
  const [startsAt, setStartsAt] = useState<string>(startsAtDefault ?? "");
  const [applyScope, setApplyScope] = useState<"single" | "future">("single");
  const timeChanged =
    isEdit &&
    (startsAt !== initial!.startsAt || Number(duration) !== initial!.durationMinutes);
  const offerScope = timeChanged && !!scope && scope.followers > 0;
  const appliedScope = offerScope ? applyScope : "single";
  const overlap = useOverlapWarning(
    startsAt,
    startsAt ? addMinutesLocal(startsAt, Number(duration)) : undefined,
    initial?.id,
    true,
    appliedScope,
  );
  const meetingUrlDefault = initial?.meetingUrl ?? "";

  return (
    <form
      // Submitted by hand rather than through the form's `action`: React resets
      // every uncontrolled field after an action runs, so a refused save (an
      // overlap, say) used to wipe the time, rate and note she had just typed
      // before she could tick "אפשר חפיפה" and save again.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-6"
      noValidate
    >
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

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
                // New sessions default to the client's treatment type
                if (!isEdit) {
                  const c = clients.find((x) => x.id === e.target.value);
                  if (c?.treatmentType) setTreatmentType(c.treatmentType);
                }
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
            {clients.length === 0 && (
              <p className="text-xs text-ink-muted mt-1">
                עוד אין לקוחות —{" "}
                <Link href="/clients/new" className="text-sage-600 hover:text-sage-700">
                  הוספת לקוח חדש
                </Link>
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startsAt">תאריך ושעה *</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={startsAtDefault}
                invalid={!!fieldErr.startsAt}
                // Moving an existing meeting puts it back on the default length;
                // the duration stays editable right beside it.
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  if (isEdit) setDuration(String(defaultMinutes));
                }}
              />
              {fieldErr.startsAt && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.startsAt[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="durationMinutes">משך (דקות) *</Label>
              <Select
                id="durationMinutes"
                name="durationMinutes"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {durationOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {offerScope && (
            <ApplyScopeChoice
              value={applyScope}
              onChange={setApplyScope}
              clientName={scope!.clientName}
              slotLabel={scope!.slotLabel}
              followers={scope!.followers}
            />
          )}

          <div>
            <Label htmlFor="treatmentType">סוג טיפול</Label>
            <Select
              id="treatmentType"
              name="treatmentType"
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">מיקום</Label>
              <Select
                id="location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="OFFICE">קליניקה</option>
                <option value="ONLINE">מקוון</option>
                <option value="HOME_VISIT">ביקור בית</option>
                <option value="OTHER">אחר</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">תעריף לפגישה (₪)</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={rateDefault}
                placeholder={ratePlaceholder ? `ברירת מחדל: ${ratePlaceholder}` : "ללא"}
              />
            </div>
          </div>

          {location === "ONLINE" && (
            <div>
              <Label htmlFor="meetingUrl">קישור לפגישה</Label>
              <Input
                id="meetingUrl"
                name="meetingUrl"
                type="url"
                placeholder="https://… (אפשר להוסיף אחר כך)"
                defaultValue={meetingUrlDefault}
                invalid={!!fieldErr.meetingUrl}
              />
              {fieldErr.meetingUrl && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.meetingUrl[0]}</p>
              )}
            </div>
          )}

          {!isEdit && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="recurrence">חזרתיות</Label>
                <Select
                  id="recurrence"
                  name="recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                >
                  <option value="NONE">ללא — פגישה בודדת</option>
                  <option value="WEEKLY">כל שבוע</option>
                  <option value="BIWEEKLY">כל שבועיים</option>
                </Select>
              </div>
              {recurrence !== "NONE" && (
                <div>
                  <Label htmlFor="seriesMode">משך הסדרה</Label>
                  <Select
                    id="seriesMode"
                    value={seriesMode}
                    onChange={(e) => setSeriesMode(e.target.value)}
                  >
                    <option value="COUNT">מספר פגישות מוגדר</option>
                    <option value="OPEN">קבוע — ללא תאריך סיום</option>
                  </Select>
                </div>
              )}
            </div>
          )}

          {!isEdit && recurrence !== "NONE" && seriesMode === "OPEN" && (
            <>
              <input type="hidden" name="openEnded" value="on" />
              <p className="text-xs text-ink-muted -mt-2">
                הפגישות ייקבעו חצי שנה קדימה, והיומן יתארך אוטומטית כל עוד הסדרה
                פעילה. אפשר לסיים בכל שלב עם ״מחיקת הסדרה מכאן והלאה״.
              </p>
            </>
          )}

          {!isEdit && recurrence !== "NONE" && seriesMode === "COUNT" && (
            <div className="sm:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="occurrences">מספר פגישות בסדרה</Label>
              <Input
                id="occurrences"
                name="occurrences"
                type="number"
                min="2"
                max="52"
                defaultValue="12"
                invalid={!!fieldErr.occurrences}
              />
              {fieldErr.occurrences && (
                <p className="text-xs text-terracotta-600 mt-1">
                  {fieldErr.occurrences[0]}
                </p>
              )}
            </div>
          )}

          {!isEdit && (
            <div>
              <Label htmlFor="note">הערה לפגישה</Label>
              <Textarea id="note" name="note" rows={3} placeholder="לא חובה" />
              <p className="text-xs text-ink-muted mt-1">
                נשמרת מוצפנת כמו כל סיכומי הפגישות, וניתן לערוך אותה בעמוד הפגישה.
              </p>
            </div>
          )}

          {overlap && (
            <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              שימו לב: הזמן חופף לפגישה קיימת — {overlap}. אפשר לבחור שעה אחרת, או
              לסמן ״אפשר חפיפה״ ולשמור.
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="allowOverlap"
              className="h-4 w-4 rounded border-cream-300 accent-sage-600"
            />
            אפשר חפיפה עם פגישות קיימות
          </label>
        </CardContent>
      </Card>

      {/* an overlap is already shown live above the checkbox; don't say it twice */}
      {state?.error && !state.fieldErrors && !(state.conflict && overlap) && (
        <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Link href={isEdit ? `/sessions/${initial!.id}` : "/calendar"}>
          <Button type="button" variant="ghost">
            ביטול
          </Button>
        </Link>
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </form>
  );
}
