"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DURATION_CHOICES, withDuration } from "@/lib/session-duration";
import {
  CLIENT_GROUPS,
  CLINIC_TYPE_MAX,
  CLINIC_TYPE_OPTIONS,
  FOCUS_OPTIONS,
  HOUR_CHOICES,
  INTRO_QUESTIONS,
  WEEK_DAYS,
  addWorkingDay,
  type ClientGroup,
  type DashboardFocus,
  type IntroAnswers,
  type IntroQuestionId,
  type WorkingDay,
} from "@/lib/intro";
import { saveIntroAnswersAction } from "@/server/actions/intro";

const CHIP =
  "px-3 py-1.5 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500";
const CHIP_OFF = "border-cream-300 bg-white/70 text-ink-soft hover:border-sage-500 hover:text-ink";
const CHIP_ON = "border-sage-600 bg-sage-600 text-cream-50";

/**
 * The שאלון היכרות's questions as form fields: the ones named in `questions`,
 * saved together by one server action. Used a question at a time by the
 * questionnaire and the single-answer editor (/my-clinic/intro), and a screen
 * at a time by the setup wizard (`formId` + `hideSave`: its own "הבא" submits).
 * Nothing is required — an empty answer is saved as "not answered".
 */
export function IntroForm({
  questions,
  initial,
  formId,
  onSaved,
  hideSave,
  saveLabel = "שמירה",
}: {
  questions: IntroQuestionId[];
  initial: IntroAnswers;
  formId?: string;
  onSaved?: () => void;
  hideSave?: boolean;
  saveLabel?: string;
}) {
  const [clinicType, setClinicType] = useState(initial.clinicType ?? "");
  const [groups, setGroups] = useState<ClientGroup[]>(initial.clientGroups);
  const [hours, setHours] = useState<WorkingDay[]>(initial.workingHours);
  const [minutes, setMinutes] = useState(String(initial.defaultSessionMinutes));
  const [rate, setRate] = useState(initial.defaultRate ?? "");
  const [focus, setFocus] = useState<DashboardFocus | null>(initial.dashboardFocus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const asks = (q: IntroQuestionId) => questions.includes(q);
  // With several questions on a screen, each carries its own heading
  const headed = questions.length > 1;
  const heading = (q: IntroQuestionId) => {
    if (!headed) return null;
    const { title, subtitle } = INTRO_QUESTIONS.find((x) => x.id === q)!;
    return (
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
      </div>
    );
  };

  const setDay = (day: number, patch: Partial<WorkingDay>) =>
    setHours((all) => all.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const bad = hours.find((d) => d.from >= d.to);
    if (asks("hours") && bad) {
      setError(`ביום ${WEEK_DAYS[bad.day]}: שעת הסיום צריכה להיות אחרי שעת ההתחלה`);
      return;
    }
    startTransition(async () => {
      const res = await saveIntroAnswersAction({
        ...(asks("type") ? { clinicType } : {}),
        ...(asks("groups") ? { clientGroups: groups } : {}),
        ...(asks("hours") ? { workingHours: hours } : {}),
        ...(asks("session") ? { defaultSessionMinutes: minutes, defaultRate: rate } : {}),
        ...(asks("focus") ? { dashboardFocus: focus ?? "" } : {}),
      });
      if (res.error) setError(res.error);
      else onSaved?.();
    });
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6">
      {asks("type") && (
        <div className="space-y-3">
          {heading("type")}
          <div>
            <Label htmlFor="clinicType">סוג המרפאה</Label>
            <Input
              id="clinicType"
              value={clinicType}
              maxLength={CLINIC_TYPE_MAX}
              onChange={(e) => setClinicType(e.target.value)}
              placeholder="לדוגמה: פסיכולוגיה קלינית לילדים ולנוער"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="הצעות לסוג המרפאה">
            {CLINIC_TYPE_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={clinicType === o}
                onClick={() => setClinicType(clinicType === o ? "" : o)}
                className={cn(CHIP, clinicType === o ? CHIP_ON : CHIP_OFF)}
              >
                {o}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">אפשר לבחור הצעה ולשנות אותה, או לכתוב שורה משלכם.</p>
        </div>
      )}

      {asks("groups") && (
        <div className="space-y-3">
          {heading("groups")}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="במי מטפלים בעיקר">
            {CLIENT_GROUPS.map((g) => {
              const on = groups.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGroups(on ? groups.filter((x) => x !== g.id) : [...groups, g.id])}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {asks("hours") && (
        <div className="space-y-3">
          {heading("hours")}
          <ul className="divide-y divide-cream-200/80 rounded-xl border border-cream-200 bg-white/60">
            {WEEK_DAYS.map((name, day) => {
              const d = hours.find((x) => x.day === day);
              return (
                <li key={day} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                  <label className="flex min-w-[5.5rem] items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sage-600"
                      checked={!!d}
                      onChange={(e) =>
                        setHours(e.target.checked ? addWorkingDay(hours, day) : hours.filter((x) => x.day !== day))
                      }
                    />
                    יום {name}
                  </label>
                  {d ? (
                    <span className="flex items-center gap-1.5 ms-auto">
                      <Select
                        aria-label={`יום ${name}: משעה`}
                        value={d.from}
                        onChange={(e) => setDay(day, { from: e.target.value })}
                        className="h-9 w-[5.5rem]"
                      >
                        {HOUR_CHOICES.slice(0, -1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                      <span className="text-ink-muted text-sm">עד</span>
                      <Select
                        aria-label={`יום ${name}: עד שעה`}
                        value={d.to}
                        onChange={(e) => setDay(day, { to: e.target.value })}
                        className="h-9 w-[5.5rem]"
                      >
                        {HOUR_CHOICES.slice(1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </span>
                  ) : (
                    <span className="ms-auto text-xs text-ink-muted">לא עובדים</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-muted">
            בלי אף יום מסומן היומן נשאר כמו שהוא. הסימון רק צובע את היומן, ולא מונע קביעת פגישה בשום שעה.
          </p>
        </div>
      )}

      {asks("session") && (
        <div className="space-y-3">
          {heading("session")}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="introMinutes">משך פגישה רגיל</Label>
              <Select id="introMinutes" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
                {withDuration(DURATION_CHOICES, initial.defaultSessionMinutes).map((m) => (
                  <option key={m} value={m}>
                    {m} דקות
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="introRate">מחיר רגיל לפגישה (₪)</Label>
              <Input
                id="introRate"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="ללא"
              />
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            פגישה חדשה תיפתח עם המשך הזה, ותקבל את המחיר הזה כשללקוח/ה אין מחיר משלו/ה ולא הוקלד מחיר אחר.
            פגישות שכבר נקבעו לא משתנות.
          </p>
        </div>
      )}

      {asks("focus") && (
        <div className="space-y-3">
          {heading("focus")}
          <div className="space-y-2" role="radiogroup" aria-label="מה הכי חשוב לראות ראשון">
            {[...FOCUS_OPTIONS, { id: null, label: "בלי העדפה", hint: "מסך הבית נשאר בסדר הרגיל." }].map((o) => {
              const on = focus === o.id;
              return (
                <button
                  key={o.id ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFocus(o.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500",
                    on ? "border-sage-600 bg-sage-50" : "border-cream-300 bg-white/70 hover:border-sage-500",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                      on ? "border-sage-600" : "border-cream-400",
                    )}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-sage-600" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{o.label}</span>
                    <span className="block text-xs text-ink-muted">{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600"
        >
          {error}
        </p>
      )}

      {!hideSave && (
        <Button type="submit" disabled={pending}>
          {pending ? "שומר…" : saveLabel}
        </Button>
      )}
    </form>
  );
}
