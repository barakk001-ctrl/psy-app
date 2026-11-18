"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IntroForm } from "@/components/intro/intro-form";
import { INTRO_QUESTIONS, type IntroAnswers, type IntroQuestionId } from "@/lib/intro";
import { MY_CLINIC_PATH } from "@/lib/my-clinic";
import { finishIntroAction } from "@/server/actions/intro";

const FORM_ID = "intro-step-form";
const BACK_TO = `${MY_CLINIC_PATH}#intro`;

/**
 * The שאלון היכרות, a question per screen. "הבא" saves the answer and moves
 * on, "דילוג" moves on without saving, and "לדלג על השאלון" ends it; ending it
 * either way stops the invitation on "המרפאה שלי" (finishIntroAction).
 */
export function IntroStepper({ initial }: { initial: IntroAnswers }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = INTRO_QUESTIONS.length;
  const question = INTRO_QUESTIONS[index];
  const last = index === total - 1;

  const finish = () =>
    startBusy(async () => {
      setError(null);
      const res = await finishIntroAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(BACK_TO);
      router.refresh();
    });
  const next = () => (last ? finish() : setIndex(index + 1));

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">
              שאלה {index + 1} מתוך {total}
            </span>
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="min-h-11 px-1 text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              לדלג על השאלון
            </button>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-200"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            aria-label="התקדמות בשאלון"
          >
            <div
              className="h-full rounded-full bg-sage-500 transition-all"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <p className="font-display text-2xl text-ink leading-tight">{question.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{question.subtitle}</p>
        </div>

        <IntroForm
          key={question.id}
          questions={[question.id]}
          initial={initial}
          formId={FORM_ID}
          onSaved={next}
          hideSave
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-cream-200/80 pt-4">
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              aria-label="חזרה לשאלה הקודמת"
              className="h-11 w-11 shrink-0 p-0"
              onClick={() => setIndex(index - 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
          <Button type="submit" form={FORM_ID} className="h-11 flex-1" disabled={busy}>
            {last ? "שמירה וסיום" : "הבא"}
          </Button>
          <Button type="button" variant="secondary" className="h-11" disabled={busy} onClick={next}>
            דילוג
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** One answer, opened from its row on "המרפאה שלי". */
export function IntroEdit({ question, initial }: { question: IntroQuestionId; initial: IntroAnswers }) {
  const router = useRouter();
  const q = INTRO_QUESTIONS.find((x) => x.id === question)!;
  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <p className="font-display text-2xl text-ink leading-tight">{q.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{q.subtitle}</p>
        </div>
        <IntroForm
          questions={[question]}
          initial={initial}
          formId={FORM_ID}
          hideSave
          onSaved={() => {
            router.push(BACK_TO);
            router.refresh();
          }}
        />
        <div className="flex items-center gap-2 border-t border-cream-200/80 pt-4">
          <Button type="submit" form={FORM_ID} className="h-11">
            שמירה
          </Button>
          <Link
            href={BACK_TO}
            className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ביטול
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** "לא עכשיו" on the invitation card of "המרפאה שלי". */
export function IntroDismiss() {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy}
      onClick={() =>
        startBusy(async () => {
          await finishIntroAction();
          router.refresh();
        })
      }
    >
      לא עכשיו
    </Button>
  );
}
