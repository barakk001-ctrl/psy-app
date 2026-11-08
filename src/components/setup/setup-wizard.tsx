"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo-mark";
import { ExplainerVideo } from "@/components/auth/explainer-video";
import { BrandingCard } from "@/components/settings/branding-card";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { MeetingTypesCard } from "@/components/settings/meeting-types-card";
import { FORM_STEPS, LAST_STEP, SETUP_STEPS } from "@/lib/onboarding";
import { pauseOnboardingAction, setOnboardingStepAction } from "@/server/actions/onboarding";

const FORM_ID = "setup-step-form";

type Props = {
  step: number;
  brand: React.ComponentProps<typeof BrandingCard>["initial"];
  business: React.ComponentProps<typeof BusinessInfoForm>["initial"];
  meetingTypes: React.ComponentProps<typeof MeetingTypesCard>["types"];
  defaultMinutes: number;
  /** income/expense documents shown (src/lib/features.ts) */
  documents: boolean;
};

/**
 * One topic per screen, each an existing Settings card. "הבא" submits the
 * card's own form through its own server action and moves on once it saved;
 * "דילוג" moves on without saving. Nothing is required.
 */
export function SetupWizard({ step, brand, business, meetingTypes, defaultMinutes, documents }: Props) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = SETUP_STEPS[step];
  const isDone = current.id === "done";

  const goTo = (next: number) =>
    startBusy(async () => {
      setError(null);
      const res = await setOnboardingStepAction(next);
      if (!res.ok) {
        setError(res.error ?? "השמירה נכשלה");
        setSaving(false);
        return;
      }
      router.push(`/setup?step=${next + 1}`);
      router.refresh();
    });
  const advance = () => goTo(Math.min(step + 1, LAST_STEP));

  const onNext = () => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return advance();
    setSaving(true);
    form.requestSubmit();
    // A refused save stays here with its message; give the button back
    window.setTimeout(() => setSaving(false), 4000);
  };

  const pause = () =>
    startBusy(async () => {
      await pauseOnboardingAction();
      router.push("/dashboard");
      router.refresh();
    });

  const shared = { formId: FORM_ID, onSaved: advance };

  return (
    <div className="setup-shell flex h-dvh flex-col bg-cream-50 pt-[env(safe-area-inset-top)]">
      <header className="shrink-0 border-b border-cream-200 bg-cream-50 px-4 pb-3 pt-3">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LogoMark size={32} />
              {!isDone && (
                <span className="text-sm text-ink-muted">
                  שלב {step + 1} מתוך {FORM_STEPS}
                </span>
              )}
            </div>
            {!isDone && (
              <button
                type="button"
                onClick={pause}
                disabled={busy}
                className="min-h-11 px-1 text-sm text-ink-muted underline underline-offset-2"
              >
                לסיים מאוחר יותר
              </button>
            )}
          </div>
          {!isDone && (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={FORM_STEPS}
              aria-valuenow={step + 1}
              aria-label="התקדמות בהגדרה"
            >
              <div
                className="h-full rounded-full bg-sage-500 transition-all"
                style={{ width: `${((step + 1) / FORM_STEPS) * 100}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <div className="mx-auto max-w-xl space-y-4">
          {isDone && <CheckCircle2 className="mx-auto h-14 w-14 text-sage-600" />}
          <div className={isDone ? "text-center" : ""}>
            <h1 className="font-display text-2xl text-ink">{current.title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{current.subtitle}</p>
          </div>

          {current.id === "brand" && <BrandingCard initial={brand} documents={documents} {...shared} hideSave />}
          {current.id === "business" && <BusinessInfoForm initial={business} documents={documents} {...shared} hideSave />}
          {current.id === "types" && (
            <MeetingTypesCard types={meetingTypes} defaultMinutes={defaultMinutes} {...shared} hideSave />
          )}

          {isDone && (
            <div className="space-y-3 pt-2">
              <Link
                href="/clients/new"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-sage-500 to-sage-600 px-5 text-sm font-medium text-cream-50 shadow-glow"
              >
                <UserPlus className="h-5 w-5" />
                הוספת לקוח/ה ראשון/ה
              </Link>
              <Link
                href="/dashboard"
                className="flex min-h-12 items-center justify-center rounded-xl border border-cream-300 bg-white/70 px-5 text-sm font-medium text-ink"
              >
                למסך הבית
              </Link>
              <div className="flex min-h-11 items-center justify-center">
                <ExplainerVideo />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              {error}
            </p>
          )}
        </div>
      </main>

      {!isDone && (
        <footer className="shrink-0 border-t border-cream-200 bg-cream-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                aria-label="חזרה לשלב הקודם"
                className="h-12 w-12 shrink-0 p-0"
                onClick={() => router.push(`/setup?step=${step}`)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            <Button type="button" className="h-12 flex-1" disabled={busy || saving} onClick={onNext}>
              {busy || saving ? "שומר…" : "הבא"}
            </Button>
            <Button type="button" variant="secondary" className="h-12" disabled={busy} onClick={advance}>
              דילוג
            </Button>
          </div>
        </footer>
      )}

      {/* The step heading replaces each card's own title; comfortable tap
          targets for the Settings cards shown in here (inline links grow by
          padding, so the text flow stays put) */}
      <style>{`
        .setup-shell main form h2:first-child,
        .setup-shell main div:has(> h3:only-child):has(+ div) { display: none; }
        .setup-shell input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .setup-shell select,
        .setup-shell main button:not(.w-5):not(.w-8) { min-height: 44px; }
        .setup-shell main p a, .setup-shell main li a { padding-block: 13px; margin-block: -13px; }
        .setup-shell main label:has(input[type="checkbox"]) { min-height: 44px; align-items: center; }
      `}</style>
    </div>
  );
}
