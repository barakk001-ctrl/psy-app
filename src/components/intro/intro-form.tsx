"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DURATION_CHOICES, withDuration } from "@/lib/session-duration";
import { CLIENT_WORDS, type ClientWordId } from "@/lib/client-word";
import { COLOR_THEMES, themeVars, type ColorThemeId } from "@/lib/color-themes";
import {
  CLIENT_GROUPS,
  CLIENT_GROUPS_OTHER_LABEL,
  CLIENT_GROUPS_OTHER_MAX,
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
import { useSay } from "@/components/layout/client-word";

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
  const say = useSay();
  const [clinicType, setClinicType] = useState(initial.clinicType ?? "");
  const [groups, setGroups] = useState<ClientGroup[]>(initial.clientGroups);
  // "אחר": the chip opens a line for the practice's own words
  const [otherOn, setOtherOn] = useState(!!initial.clientGroupsOther);
  const [other, setOther] = useState(initial.clientGroupsOther ?? "");
  const [hours, setHours] = useState<WorkingDay[]>(initial.workingHours);
  const [minutes, setMinutes] = useState(String(initial.defaultSessionMinutes));
  const [rate, setRate] = useState(initial.defaultRate ?? "");
  const [focus, setFocus] = useState<DashboardFocus | null>(initial.dashboardFocus);
  const [theme, setTheme] = useState<ColorThemeId>(initial.colorTheme);
  const [word, setWord] = useState<ClientWordId>(initial.clientWord);
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

  // The page takes on a picked colour set at once, before it is saved. Leaving
  // the question puts the saved set back: the variables set here come off, and
  // the layout's own <ThemeStyle> (which a save has refreshed) rules again.
  const asksColor = questions.includes("color");
  useEffect(() => {
    if (!asksColor) return;
    const root = document.documentElement;
    const vars = themeVars(theme);
    for (const [name, value] of vars) root.style.setProperty(name, value);
    return () => {
      for (const [name] of vars) root.style.removeProperty(name);
    };
  }, [asksColor, theme]);

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
        ...(asks("groups") ? { clientGroups: groups, clientGroupsOther: otherOn ? other : "" } : {}),
        ...(asks("hours") ? { workingHours: hours } : {}),
        ...(asks("session") ? { defaultSessionMinutes: minutes, defaultRate: rate } : {}),
        ...(asks("focus") ? { dashboardFocus: focus ?? "" } : {}),
        ...(asks("color") ? { colorTheme: theme } : {}),
        ...(asks("word") ? { clientWord: word } : {}),
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
            <button
              type="button"
              aria-pressed={otherOn}
              aria-controls="clientGroupsOther"
              onClick={() => setOtherOn(!otherOn)}
              className={cn(CHIP, otherOn ? CHIP_ON : CHIP_OFF)}
            >
              {CLIENT_GROUPS_OTHER_LABEL}
            </button>
          </div>
          {otherOn && (
            <div>
              <Label htmlFor="clientGroupsOther">במי עוד מטפלים</Label>
              <Input
                id="clientGroupsOther"
                value={other}
                maxLength={CLIENT_GROUPS_OTHER_MAX}
                onChange={(e) => setOther(e.target.value)}
                placeholder="כתבו במילים שלכם"
                autoComplete="off"
              />
            </div>
          )}
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
            {say("פגישה חדשה תיפתח עם המשך הזה, ותקבל את המחיר הזה כשללקוח/ה אין מחיר משלו/ה ולא הוקלד מחיר אחר.")}
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

      {asks("color") && (
        <div className="space-y-3">
          {heading("color")}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="צבע הממשק">
            {COLOR_THEMES.map((t) => {
              const on = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex min-h-[4.5rem] flex-col gap-2 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500",
                    on ? "border-sage-600 bg-sage-50" : "border-cream-300 bg-white/70 hover:border-cream-400",
                  )}
                >
                  {/* each set in its own colours, whatever set the page is in */}
                  <span aria-hidden className="flex h-6 w-full overflow-hidden rounded-md border border-black/5">
                    <span className="flex-[3]" style={{ backgroundColor: t.scale[500] }} />
                    <span className="flex-[2]" style={{ backgroundColor: t.scale[300] }} />
                    <span className="flex-1" style={{ backgroundColor: t.scale[100] }} />
                  </span>
                  <span className="flex items-center justify-between gap-1 text-sm font-medium text-ink">
                    {t.label}
                    {on && <Check className="h-4 w-4 text-sage-600" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">
            הבחירה נראית מיד, ונשמרת בלחיצה על הכפתור שלמטה. צבעי האזהרות, המסמכים והצבע של כל סוג מפגש ביומן לא משתנים.
          </p>
        </div>
      )}

      {asks("word") && (
        <div className="space-y-3">
          {heading("word")}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="המילה למי שמגיע לטיפול">
            {CLIENT_WORDS.map((w) => {
              const on = word === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setWord(w.id)}
                  className={cn(CHIP, "min-h-10 px-4 text-base", on ? CHIP_ON : CHIP_OFF)}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">
            לדוגמה: ״{CLIENT_WORDS.find((w) => w.id === word)!.both} חדש/ה״, ״כל ה{CLIENT_WORDS.find((w) => w.id === word)!.many}״.
          </p>
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
